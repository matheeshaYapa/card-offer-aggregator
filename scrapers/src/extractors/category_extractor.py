"""
Category classifier for scraped offers.

Banks rarely tag promotions with a category we can use directly, so every
scraped offer used to be published with category_id = NULL, which made the
public category filter return nothing. This module assigns one of the
public category slugs from two kinds of evidence:

1. The bank's own label (the "Category: X" segment scrapers put in raw_text).
   When it maps to a known category it wins outright.
2. Weighted keyword and known-merchant matches across title, merchant,
   description and raw text (title and merchant count most).

Rules live in config/category_rules.json so they can be tuned without code
changes. classify() returns the slug and a 0-1 confidence; callers should
only persist the slug when confidence >= MIN_CONFIDENCE.
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

RULES_PATH = Path(__file__).resolve().parents[2] / "config" / "category_rules.json"
_LABEL_RE = re.compile(r"(?:^|\|)\s*Category:\s*([^|]+)", re.I)


@dataclass(frozen=True)
class CategoryResult:
    slug: str | None
    confidence: float
    source: str  # "label" | "keywords" | "none"
    runner_up: str | None = None


@dataclass(frozen=True)
class _Rules:
    min_confidence: float
    field_weights: dict[str, float]
    labels: dict[str, list[re.Pattern]]
    terms: dict[str, list[tuple[re.Pattern, float]]]
    brands: dict[str, list[re.Pattern]]


def _compile(pattern: str) -> re.Pattern:
    return re.compile(rf"(?<![a-z0-9])(?:{pattern})(?![a-z0-9])", re.I)


@lru_cache(maxsize=1)
def load_rules(path: str | None = None) -> _Rules:
    data = json.loads(Path(path or RULES_PATH).read_text(encoding="utf-8"))
    cats = data["categories"]
    return _Rules(
        min_confidence=float(data.get("min_confidence", 0.45)),
        field_weights={k: float(v) for k, v in data["field_weights"].items()},
        labels={slug: [re.compile(p, re.I) for p in c.get("labels", [])] for slug, c in cats.items()},
        terms={slug: [(_compile(p), float(w)) for p, w in c.get("terms", [])] for slug, c in cats.items()},
        brands={slug: [_compile(p) for p in c.get("brands", [])] for slug, c in cats.items()},
    )


MIN_CONFIDENCE = load_rules().min_confidence
BRAND_WEIGHT = 5.0
_NON_CATEGORY_LABEL = re.compile(r"^(?:all|other|others|premium|visa|mastercard|amex|card|special|exclusive|latest|new)\b", re.I)


def bank_label(raw_text: str | None) -> str | None:
    match = _LABEL_RE.search(raw_text or "")
    return match.group(1).strip() if match else None


def classify_label(label: str | None) -> str | None:
    """Map a bank's own category label (e.g. 'Super Markets', 'Hotels') to a slug."""
    if not label:
        return None
    label = re.sub(r"[_\-]+", " ", label).strip()
    if _NON_CATEGORY_LABEL.match(label):
        return None
    rules = load_rules()
    hits = [slug for slug, patterns in rules.labels.items() if any(p.search(label) for p in patterns)]
    # "Health and Insurance" or "Travel and Leisure" must not be ambiguous: first listed rule wins,
    # but a label that matches several unrelated categories (e.g. "Dining & Hotels") is ambiguous.
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        primary = re.split(r"\s+(?:and|&)\s+|,", label, maxsplit=1)[0]
        first = [slug for slug in hits if any(p.search(primary) for p in rules.labels[slug])]
        return first[0] if len(first) == 1 else None
    return None


def split_joined_words(text: str) -> str:
    """Undo scraped names run together: 'PavilionPeshawri' -> 'Pavilion Peshawri', 'Hotel1864' -> 'Hotel 1864'."""
    text = re.sub(r"(?<=[a-z])(?=[A-Z][a-z])", " ", text)
    return re.sub(r"(?<=[A-Za-z]{3})(?=\d)|(?<=\d)(?=[A-Za-z]{3})", " ", text)


def score_fields(fields: dict[str, str | None]) -> dict[str, float]:
    rules = load_rules()
    scores = {slug: 0.0 for slug in rules.terms}
    for field, text in fields.items():
        weight = rules.field_weights.get(field, 0.0)
        if not text or not weight:
            continue
        variants = {text, split_joined_words(text)}

        def hit(pattern: re.Pattern) -> bool:
            return any(pattern.search(variant) for variant in variants)

        for slug in scores:
            evidence = sum(w for pattern, w in rules.terms[slug] if hit(pattern))
            if any(hit(pattern) for pattern in rules.brands[slug]):
                evidence += BRAND_WEIGHT
            scores[slug] += evidence * weight
    return scores


def classify(
    title: str | None,
    description: str | None = None,
    merchant: str | None = None,
    raw_text: str | None = None,
) -> CategoryResult:
    label_slug = classify_label(bank_label(raw_text))
    if label_slug:
        return CategoryResult(label_slug, 0.95, "label")

    # raw_text usually repeats title/description; drop it when it adds nothing.
    extra = raw_text or ""
    for part in (title, description, merchant):
        if part:
            extra = extra.replace(part, " ")
    scores = score_fields({"title": title, "merchant": merchant, "description": description, "raw_text": extra})
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    (top, top_score), (second, second_score) = ranked[0], ranked[1]
    if top_score <= 0:
        return CategoryResult(None, 0.0, "none")

    strength = 1 - math.exp(-top_score / 6)
    separation = (top_score - second_score) / top_score
    confidence = round(strength * (0.5 + 0.5 * separation), 2)
    return CategoryResult(top, confidence, "keywords", second if second_score > 0 else None)


def detect_category(
    title: str | None,
    description: str | None = None,
    merchant: str | None = None,
    raw_text: str | None = None,
) -> tuple[str | None, float]:
    """Return (slug, confidence) — slug is None unless confidence clears MIN_CONFIDENCE."""
    result = classify(title, description, merchant, raw_text)
    if result.slug and result.confidence >= MIN_CONFIDENCE:
        return result.slug, result.confidence
    return None, result.confidence
