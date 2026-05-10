"""
NDB Bank promotions scraper.

Target: https://www.ndbbank.com/cards/card-offers

Server-rendered HTML. All ~80 offers appear on a single listing page
with no pagination. Each card is an anchor linking to a detail page:

  <a href="/cards/card-offers/offer-details/[ID]">
    <img ... alt="[offer title]">
    <img ... alt="[merchant logo]">
    <h5>[Offer title — often includes discount %]</h5>
    <p>[Merchant name]</p>
    <p>[Card eligibility e.g. "Credit Cards"]</p>
    <p>[Contact number — optional]</p>
    <p>[Validity date e.g. "Until 31st May 2026"]</p>
  </a>

Individual detail pages have:
  <h1> title, div.offer-details (dates + card type),
  div.merchant-details (h3 merchant), div.special-conditions (terms ul)

Strategy:
  All data needed is available on the listing page itself — no detail
  page visits required. Parse each <a href="/cards/card-offers/offer-details/...">
  card to extract title, merchant, card type, and validity dates.

NDB date formats (non-standard, handled by _parse_ndb_dates):
  "5th, 12th, 19th & 26th May 2026 (Tuesdays)"          → last date = valid_to
  "Every Weekend ... till 31st May 2026 (Sat & Sun)"     → "till DATE" = valid_to
  "Until 31st May 2025"                                  → "Until DATE" = valid_to
"""
import re
from datetime import date

from bs4 import BeautifulSoup, Tag

from src.extractors.date_extractor import extract_dates
from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_BASE_URL = "https://www.ndbbank.com"
_LIST_URL = f"{_BASE_URL}/cards/card-offers"

# Offer detail URL pattern
_DETAIL_HREF_RE = re.compile(r"/cards/card-offers/offer-details/\d+")

# Paragraphs that look like phone numbers or junk — skip these
_PHONE_RE = re.compile(r"^\+?[\d\s\-()]{7,}$")


class NDBScraper(BaseScraper):

    def parse(self, html: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")

        # Find every offer card link
        offer_cards: list[Tag] = [
            a for a in soup.find_all("a", href=True)
            if _DETAIL_HREF_RE.search(a["href"])
        ]

        if not offer_cards:
            logger.info("  NDB: no offer-detail links found — using generic parser")
            return self._generic_parse(html)

        logger.info("  NDB: found %d offer card(s)", len(offer_cards))

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()
        seen_urls: set[str] = set()

        for card in offer_cards:
            href = card["href"]
            source_url = f"{_BASE_URL}{href}" if href.startswith("/") else href
            if source_url in seen_urls:
                continue
            seen_urls.add(source_url)

            offer = self._card_to_offer(card, source_url)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        logger.info("  NDB: extracted %d candidate(s)", len(candidates))
        return candidates

    # ── Per-card extraction ───────────────────────────────────────────────

    def _card_to_offer(self, card: Tag, source_url: str) -> ScrapedOffer | None:
        # ── Title from <h5> ───────────────────────────────────────────────
        h = card.find(["h5", "h4", "h3"])
        title = clean_text(h.get_text()) if h else None

        # Fallback: alt text on main (first) image
        if not title:
            img = card.find("img")
            if img and img.get("alt"):
                title = clean_text(img["alt"])

        if not title or len(title) < 5:
            return None

        # ── Paragraphs: merchant, card type, dates ────────────────────────
        paras = [clean_text(p.get_text()) for p in card.find_all("p") if p.get_text(strip=True)]
        # Filter out phone numbers and very short strings
        paras = [p for p in paras if p and len(p) > 2 and not _PHONE_RE.match(p)]

        merchant   = paras[0] if paras else None
        card_type  = paras[1] if len(paras) > 1 else None

        # Last non-empty paragraph most likely contains dates
        date_text = ""
        for p in reversed(paras):
            if re.search(r"\d{4}|till|until|valid|every|from", p, re.IGNORECASE):
                date_text = p
                break

        # ── Dates ─────────────────────────────────────────────────────────
        # Try the standard extractor first, then NDB-specific parsing as fallback.
        combined   = f"{date_text} {title}".strip()
        dates      = extract_dates(combined)
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        if not valid_to and date_text:
            valid_from_ndb, valid_to_ndb = _parse_ndb_dates(date_text)
            valid_from = valid_from or valid_from_ndb
            valid_to   = valid_to   or valid_to_ndb

        # ── Discount from title ───────────────────────────────────────────
        discount = extract_discount(title) or None

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts = [title]
        if merchant:   raw_parts.append(f"Merchant: {merchant}")
        if card_type:  raw_parts.append(f"Card: {card_type}")
        if date_text:  raw_parts.append(date_text)
        raw_text = " | ".join(raw_parts)

        # ── Confidence ────────────────────────────────────────────────────
        score = 0.60
        if discount:    score += 0.15
        if valid_to:    score += 0.15
        if valid_from:  score += 0.05
        if merchant:    score += 0.05

        ch = generate_candidate_hash(
            source_url, title, discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )

        return ScrapedOffer(
            title=title,
            description=date_text or None,
            raw_text=truncate(raw_text, 2000),
            source_url=source_url,
            detected_merchant=merchant,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=ch,
        )


# ── Module helpers ────────────────────────────────────────────────────────────

_NDB_MONTHS: dict[str, int] = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9,
    "oct": 10, "nov": 11, "dec": 12,
}

_MONTH_NAMES = (
    "January|February|March|April|May|June|July|August|September|"
    "October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec"
)

# Matches "31st May 2026", "5th May 2026", "26 May 2026"
_ORDINAL_DATE_RE = re.compile(
    r"(\d{1,2})(?:st|nd|rd|th)?\s+(" + _MONTH_NAMES + r")\s+(\d{4})",
    re.IGNORECASE,
)

# Matches "till/until/up to 31st May 2026"
_TILL_RE = re.compile(
    r"(?:till|until|up\s+to)\s+(\d{1,2}(?:st|nd|rd|th)?\s+"
    r"(?:" + _MONTH_NAMES + r")\s+\d{4})",
    re.IGNORECASE,
)

# Matches "from DATE to/till DATE"
_FROM_TO_RE = re.compile(
    r"from\s+(.+?)\s+(?:to|till)\s+"
    r"(\d{1,2}(?:st|nd|rd|th)?\s+(?:" + _MONTH_NAMES + r")\s+\d{4})",
    re.IGNORECASE,
)


def _parse_ndb_dates(text: str) -> tuple[date | None, date | None]:
    """
    Parse NDB-specific date formats that date_extractor.py does not handle:

      "5th, 12th, 19th & 26th May 2026 (Tuesdays)"
        → valid_to = last ordinal date in string (26th May 2026)

      "Every Weekend from Every Weekend till 31st May 2026 (Saturday & Sunday)"
        → valid_to = date after 'till' (31st May 2026)

      "Until 31st May 2025"
        → valid_to = date after 'Until' (31st May 2025)
    """
    valid_from: date | None = None
    valid_to:   date | None = None

    # 1. "till / until / up to DATE"
    m = _TILL_RE.search(text)
    if m:
        valid_to = _ordinal_to_date(m.group(1))

    # 2. "from DATE to/till DATE" — extracts both bounds
    m2 = _FROM_TO_RE.search(text)
    if m2:
        valid_from = valid_from or _ordinal_to_date(m2.group(1))
        valid_to   = valid_to   or _ordinal_to_date(m2.group(2))

    # 3. Last ordinal date in text → valid_to
    #    Handles "5th, 12th, 19th & 26th May 2026 (Tuesdays)"
    if not valid_to:
        all_matches = _ORDINAL_DATE_RE.findall(text)
        if all_matches:
            day_s, month_s, year_s = all_matches[-1]
            mon = _NDB_MONTHS.get(month_s.lower())
            if mon:
                try:
                    valid_to = date(int(year_s), mon, int(day_s))
                except Exception:
                    pass

    return valid_from, valid_to


def _ordinal_to_date(date_str: str) -> date | None:
    """Convert '31st May 2026' or '31 May 2026' to a date object."""
    m = _ORDINAL_DATE_RE.search(date_str)
    if not m:
        return None
    day_s, month_s, year_s = m.group(1), m.group(2), m.group(3)
    mon = _NDB_MONTHS.get(month_s.lower())
    if not mon:
        return None
    try:
        return date(int(year_s), mon, int(day_s))
    except Exception:
        return None
