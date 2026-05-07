"""
HNB (Hatton National Bank) promotions scraper.

HNB's website (https://www.hnb.lk/card-promotion) is a React SPA.
A plain requests.get() returns an empty HTML shell — no offer data.

Instead we call the JSON API that the React frontend itself uses:

  List (paginated, 10/page):
    GET https://venus.hnb.lk/api/get_all_web_card_promos?page={n}&cardType=All
    Response: { page, limit, total, totalPages,
                data: [{id, title, merchant, cardType, to, valid}, ...] }

  Detail (rich HTML content):
    GET https://venus.hnb.lk/api/get_web_card_promo?id={id}
    Response: { title, from, to, valid, cardType, content (HTML), merchant, assets }

Strategy: paginate the list API (currently ~75 pages × 10 = ~743 offers) and
build ScrapedOffer objects from the structured list data.  No HTML parsing needed.
"""
import re
import time
from datetime import date

import requests

from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_API_BASE = "https://venus.hnb.lk/api"
_LIST_URL = f"{_API_BASE}/get_all_web_card_promos"
_SOURCE_URL = "https://www.hnb.lk/card-promotion"

# Request headers that mirror the browser's own API calls
_API_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.hnb.lk/",
    "Origin": "https://www.hnb.lk",
}

# "Valid From 2026-04-01 to " → capture the start date
_VALID_FROM_RE = re.compile(r"Valid From (\d{4}-\d{2}-\d{2})", re.IGNORECASE)

# Discount patterns found in HNB offer titles
_DISCOUNT_RE = re.compile(
    r"(?:up\s+to\s+)?"
    r"(?:"
    r"\d+(?:\.\d+)?\s*%"           # 50%, 12.5%
    r"|\d+\s+months?\s+0%"          # 12 months 0%
    r"|\d+\s+months?\s+free"        # 3 months free
    r"|Rs\.?\s*[\d,]+"              # Rs. 500 off
    r")",
    re.IGNORECASE,
)


class HNBScraper(BaseScraper):
    """Scrapes HNB promotions by calling the venus.hnb.lk JSON API directly."""

    # ── Public entry point ────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """
        Override BaseScraper.run(): calls the JSON API instead of fetching HTML.
        """
        logger.info("  HNB: API-based scraper → %s", _LIST_URL)
        all_items = self._fetch_all_pages()
        logger.info("  HNB: fetched %d raw offer(s) from API", len(all_items))

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for item in all_items:
            offer = self._item_to_offer(item)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        logger.info("  HNB: produced %d unique candidate(s)", len(candidates))
        return candidates

    # parse() is required by the ABC but never called because run() is overridden.
    def parse(self, html: str) -> list[ScrapedOffer]:  # pragma: no cover
        return []

    # ── API pagination ────────────────────────────────────────────────────

    def _fetch_all_pages(self) -> list[dict]:
        """Paginate through all pages of the list API and return raw item dicts."""
        items: list[dict] = []
        page = 1

        while True:
            try:
                resp = requests.get(
                    _LIST_URL,
                    params={"page": page, "cardType": "All"},
                    headers=_API_HEADERS,
                    timeout=20,
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                logger.warning("  HNB: failed to fetch page %d: %s", page, exc)
                break

            page_items = data.get("data") or []
            if not page_items:
                logger.debug("  HNB: page %d returned no items — stopping", page)
                break

            items.extend(page_items)
            total_pages = int(data.get("totalPages") or 1)
            logger.debug(
                "  HNB: page %d/%d — %d item(s) (running total: %d)",
                page, total_pages, len(page_items), len(items),
            )

            if page >= total_pages:
                break

            page += 1
            time.sleep(0.15)   # ~150 ms between pages — polite but not slow

        return items

    # ── Offer mapping ─────────────────────────────────────────────────────

    def _item_to_offer(self, item: dict) -> ScrapedOffer | None:
        """Convert a single list-API item dict into a ScrapedOffer."""
        title = clean_text(item.get("title") or "")
        if not title or len(title) < 8:
            return None

        merchant  = clean_text(item.get("merchant") or "") or None
        card_type = (item.get("cardType") or "").lower()   # "credit" | "debit"

        valid_to   = _parse_iso_date(item.get("to"))
        valid_from = _parse_valid_from_string(item.get("valid") or "")
        discount   = _extract_discount(title)

        # Build a compact raw_text for the candidate record
        parts: list[str] = [title]
        if merchant:
            parts.append(f"Merchant: {merchant}")
        if card_type:
            parts.append(f"Card type: {card_type}")
        if valid_from:
            parts.append(f"Valid from: {valid_from.isoformat()}")
        if valid_to:
            parts.append(f"Valid to: {valid_to.isoformat()}")
        raw_text = " | ".join(parts)

        # Confidence — API data is well-structured so we start high
        score = 0.60
        if discount:
            score += 0.20
        if valid_to:
            score += 0.10
        if valid_from:
            score += 0.05
        if merchant:
            score += 0.05

        candidate_hash = generate_candidate_hash(
            _SOURCE_URL,
            title,
            discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )

        return ScrapedOffer(
            title=title,
            description=None,
            raw_text=truncate(raw_text, 2000),
            source_url=_SOURCE_URL,
            detected_merchant=merchant,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=candidate_hash,
        )


# ── Module-level helpers ──────────────────────────────────────────────────────

def _parse_iso_date(value: str | None) -> date | None:
    """Parse 'YYYY-MM-DD' string into a date object; returns None on failure."""
    if not value:
        return None
    try:
        parts = str(value).strip().split("-")
        return date(int(parts[0]), int(parts[1]), int(parts[2]))
    except Exception:
        return None


def _parse_valid_from_string(valid_str: str) -> date | None:
    """
    Parse the start date from HNB's 'valid' field.
    e.g. 'Valid From 2026-04-01 to ' → date(2026, 4, 1)
    """
    m = _VALID_FROM_RE.search(valid_str)
    if not m:
        return None
    return _parse_iso_date(m.group(1))


def _extract_discount(title: str) -> str | None:
    """Extract the best discount token from an offer title."""
    m = _DISCOUNT_RE.search(title)
    if m:
        return clean_text(m.group(0))
    return None
