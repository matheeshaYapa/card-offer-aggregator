"""
Evidence-based confidence scoring for scraped offers.

Each bank parser gives a *parser score*: how complete its extraction was
(structured APIs start high, then +discount, +end date ...). Completeness is
not correctness, so this module re-scores every candidate after a source has
been parsed, using checks a reviewer would make:

* Is the title a real offer (not a page heading, placeholder or template)?
* Does the benefit actually appear in the bank's text, and is it plausible?
* Are the dates plausible (not years ahead, not starting months from now)?
* Is the description the same boilerplate repeated across the whole page?
* Do several different offers share one title (so the title can't identify them)?
* Can we tell which category it belongs to?

The final score is   parser_score × Π(1 − penalty)   over the flags raised.
Flags in HARD_FLAGS block auto-publishing outright, whatever the score.
If most of a source's offers carry hard flags, the parser has probably
drifted (the bank changed its page), so the whole batch is held for review.

Every flag is stored on the candidate (quality_flags) so admins can see why
an offer was held, and calibrate_confidence.py can measure which flags
predict rejection.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta

from src.extractors.category_extractor import detect_category
from src.models.scraped_offer import ScrapedOffer

# flag -> multiplicative penalty
PENALTIES: dict[str, float] = {
    "placeholder_title": 0.60,
    "generic_title": 0.35,
    "benefit_not_in_text": 0.35,
    "implausible_benefit": 0.35,
    "duplicate_title": 0.25,
    "vague_benefit": 0.25,
    "far_future_end": 0.20,
    "joined_words": 0.15,
    "long_title": 0.10,
    "starts_far_ahead": 0.10,
    "no_merchant": 0.05,
    "no_category": 0.05,
    "boilerplate_description": 0.0,  # description is dropped instead
    "batch_anomaly": 0.30,
}
HARD_FLAGS = {"placeholder_title", "generic_title", "benefit_not_in_text", "implausible_benefit", "batch_anomaly"}
FLAG_LABELS = {
    "placeholder_title": "Title is a placeholder or template",
    "generic_title": "Title is a page heading, not an offer",
    "benefit_not_in_text": "Benefit not found in the bank's text",
    "implausible_benefit": "Benefit value looks implausible",
    "duplicate_title": "Several offers share this title",
    "vague_benefit": "Benefit has no value (e.g. 'Special offer')",
    "far_future_end": "End date is unusually far ahead",
    "joined_words": "Title has words run together",
    "long_title": "Title is unusually long",
    "starts_far_ahead": "Starts more than 90 days from now",
    "no_merchant": "No merchant detected",
    "no_category": "No category detected",
    "boilerplate_description": "Description was page boilerplate (removed)",
    "batch_anomaly": "Most offers from this source failed checks",
}

BATCH_ANOMALY_SHARE = 0.5
BATCH_ANOMALY_MIN_SIZE = 5
FAR_FUTURE_DAYS = 548  # ~18 months
STARTS_AHEAD_DAYS = 90

_PLACEHOLDER = re.compile(
    r"\{\{|\}\}|<[^>]+>|^\s*(?:merchant name|offer|offers|title|untitled|lorem ipsum.*|tba|n/?a|null|undefined)\s*$",
    re.I,
)
_GENERIC = re.compile(
    r"^\s*(?:(?:exclusive|special|latest|amazing|great|card|credit card|debit card|visa|mastercard|amex|global|sri lanka|"
    r"visa global|visa sri lanka|premium)\s+)*(?:offers?|promotions?|deals?|privileges?)"
    r"(?:\s+for\s+[\w ]*card ?holders?)?\s*[!.]*\s*$"
    r"|^\s*(?:treat yourself|rejuvenate and reward yourself)\b"
    r"|^\s*(?:read|learn|view|see) more\s*$",
    re.I,
)
_JOINED = re.compile(r"[a-z][A-Z][a-z]")
_PERCENT = re.compile(r"(\d{1,3})\s*%")
_AMOUNT = re.compile(r"(?:rs\.?|lkr)\s*([\d,]+)", re.I)


@dataclass
class BatchReport:
    size: int
    hard_flagged: int
    anomaly: bool
    flag_counts: Counter = field(default_factory=Counter)

    def summary(self) -> str:
        top = ", ".join(f"{flag} {count}" for flag, count in self.flag_counts.most_common(5))
        return f"{self.hard_flagged}/{self.size} offers failed hard checks" + (f" ({top})" if top else "")


def _norm(text: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def _evidence_text(offer: ScrapedOffer) -> str:
    return " ".join(filter(None, (offer.title, offer.description, offer.raw_text)))


def benefit_supported(discount: str | None, evidence: str) -> bool:
    """
    False only when the text contradicts the benefit: it states percentages
    (or rupee amounts) but not the one we extracted. Text without any figures
    is not evidence either way, since some parsers read the benefit from a
    separate field.
    """
    if not discount:
        return True
    evidence_norm = evidence.replace(",", "")
    stated_pcts = {int(p) for p in _PERCENT.findall(evidence_norm)}
    for pct in _PERCENT.findall(discount):
        if stated_pcts and int(pct) not in stated_pcts:
            return False
    stated_amounts = {a.replace(",", "") for a in _AMOUNT.findall(evidence_norm)}
    for amount in _AMOUNT.findall(discount):
        if stated_amounts and amount.replace(",", "") not in stated_amounts:
            return False
    return True


def offer_flags(offer: ScrapedOffer, today: date) -> list[str]:
    """Checks that need only the offer itself."""
    flags: list[str] = []
    title = (offer.title or "").strip()

    if title and _PLACEHOLDER.search(title):
        flags.append("placeholder_title")
    elif title and _GENERIC.search(title):
        flags.append("generic_title")
    # Brand names like "PickMe" or "ComBank" have one or two such joins; merged lists have more.
    if len(_JOINED.findall(title)) >= 3:
        flags.append("joined_words")
    if len(title) > 140:
        flags.append("long_title")

    if not benefit_supported(offer.detected_discount, _evidence_text(offer)):
        flags.append("benefit_not_in_text")
    benefit = offer.detected_discount or ""
    if benefit.strip() and not re.search(r"\d|free|cash ?back|buy \d+ get|bogo|complimentary|instal+ment", benefit, re.I):
        flags.append("vague_benefit")
    percents = [int(p) for p in _PERCENT.findall(benefit)]
    if any(p > 90 for p in percents) and not re.search(r"cash ?back", benefit, re.I):
        flags.append("implausible_benefit")

    if offer.detected_valid_to and offer.detected_valid_to > today + timedelta(days=FAR_FUTURE_DAYS):
        flags.append("far_future_end")
    if offer.detected_valid_from and offer.detected_valid_from > today + timedelta(days=STARTS_AHEAD_DAYS):
        flags.append("starts_far_ahead")

    if not (offer.detected_merchant or "").strip():
        flags.append("no_merchant")
    return flags


def assess_batch(offers: list[ScrapedOffer], today: date) -> tuple[list[ScrapedOffer], BatchReport]:
    """Re-score one source's offers. Returns updated copies and a batch report."""
    descriptions = Counter(_norm(o.description) for o in offers if _norm(o.description))
    titles = Counter(_norm(o.title) for o in offers if _norm(o.title))
    # Offers sharing a title are only ambiguous when they are different offers.
    distinct_per_title: dict[str, set] = {}
    for o in offers:
        key = _norm(o.title)
        if key:
            distinct_per_title.setdefault(key, set()).add((o.source_url, o.detected_valid_to, o.detected_merchant))
    boilerplate_min = max(3, round(0.25 * len(offers)))

    assessed: list[ScrapedOffer] = []
    for offer in offers:
        flags = offer_flags(offer, today)
        updates: dict = {}

        desc = _norm(offer.description)
        if desc and descriptions[desc] >= boilerplate_min:
            flags.append("boilerplate_description")
            updates["description"] = None

        title = _norm(offer.title)
        if title and titles[title] >= 2 and len(distinct_per_title.get(title, ())) >= 2:
            flags.append("duplicate_title")

        slug, cat_conf = detect_category(
            offer.title, updates.get("description", offer.description), offer.detected_merchant, offer.raw_text,
        )
        if not slug:
            flags.append("no_category")
        updates.update(
            detected_category=slug,
            category_confidence=cat_conf,
            parser_score=offer.parser_score if offer.parser_score is not None else offer.confidence_score,
        )
        updates["quality_flags"] = sorted(set(flags))
        updates["confidence_score"] = score(updates["parser_score"], updates["quality_flags"])
        assessed.append(offer.model_copy(update=updates))

    flag_counts = Counter(flag for o in assessed for flag in o.quality_flags)
    hard = sum(bool(HARD_FLAGS & set(o.quality_flags)) for o in assessed)
    anomaly = len(assessed) >= BATCH_ANOMALY_MIN_SIZE and hard / len(assessed) >= BATCH_ANOMALY_SHARE
    if anomaly:
        assessed = [
            o.model_copy(update={
                "quality_flags": sorted({*o.quality_flags, "batch_anomaly"}),
                "confidence_score": score(o.parser_score, [*o.quality_flags, "batch_anomaly"]),
            })
            for o in assessed
        ]
    return assessed, BatchReport(len(assessed), hard, anomaly, flag_counts)


def score(parser_score: float, flags: list[str]) -> float:
    value = float(parser_score)
    for flag in set(flags):
        value *= 1 - PENALTIES.get(flag, 0.0)
    return round(max(0.0, min(value, 1.0)), 2)


def hard_flags(flags: list[str] | None) -> list[str]:
    return sorted(HARD_FLAGS & set(flags or []))
