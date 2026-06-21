"""
People's Bank promotions scraper.

Target: https://www.peoplesbank.lk/special-offers/

People's Bank uses a category-based structure. The hub page (/special-offers/)
links to category pages of the form:

    /promotion-category/<category>/?cardType=credit_card

As of 2026-06 each category page server-renders offer cards like:

  <article class="offer-card">
    <div class="discount-badge">40%</div>
    <div class="offer-image"><a href="/promotion/<slug>/"><img alt="…"></a></div>
    <div class="card-content">
      <a href="/promotion/<slug>/"><div class="promo-short">Radisson Hotel Kandy</div></a>
      <div class="meta">
        <span class="merchant-name">Restaurant - … 40% Off … …See more</span>
        <span class="valid-date">(21st June 2026)</span>
      </div>
    </div>
  </article>

Strategy:
  1. Discover the live category slugs from the hub page (falls back to a known
     list). This keeps the scraper resilient to category renames.
  2. Fetch each category page (credit cards).
  3. Parse every <article class="offer-card">: discount badge, merchant
     (.promo-short), offer details (.merchant-name), validity (.valid-date),
     and the individual /promotion/<slug>/ URL.
"""
import re
import time
from datetime import date

from bs4 import BeautifulSoup, Tag
from dateutil import parser as dateutil_parser

from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_BASE_URL = "https://www.peoplesbank.lk"
_HUB_URL  = f"{_BASE_URL}/special-offers/"

# Fallback category slugs if hub discovery fails (confirmed 2026-06).
_FALLBACK_CATEGORIES = [
    "leisure", "restaurants", "online-stores", "home-care-electronics",
    "supermarkets", "jewellers", "auto-mobile", "travel", "visa", "wellness",
]


class PeoplesBankScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """Discover categories from the hub, then scrape each category page."""
        categories = self._discover_categories()
        logger.info("  PeoplesBank: %d categor(ies) to scrape", len(categories))

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for cat in categories:
            url = f"{_BASE_URL}/promotion-category/{cat}/?cardType=credit_card"
            try:
                html = self.fetch_html(url)
                page_offers = self._parse_category_page(html, url, "credit")
                new_count = 0
                for offer in page_offers:
                    if offer.candidate_hash not in seen_hashes:
                        seen_hashes.add(offer.candidate_hash)
                        candidates.append(offer)
                        new_count += 1
                logger.info("  PeoplesBank: %-22s → %d candidate(s)", cat, new_count)
            except Exception as exc:
                logger.warning("  PeoplesBank: failed for %s: %s", cat, exc)
            time.sleep(0.5)   # polite rate limit

        logger.info("  PeoplesBank: %d unique candidate(s) total", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:
        """Fallback used when BaseScraper.run() calls parse(html)."""
        return self._parse_category_page(html, self.source_url, "credit")

    # ── Category discovery ────────────────────────────────────────────────

    def _discover_categories(self) -> list[str]:
        """Read category slugs from the hub page; fall back to known list."""
        try:
            html = self.fetch_html(_HUB_URL)
            slugs = sorted(set(re.findall(
                r"/promotion-category/([a-z0-9-]+)/", html, re.IGNORECASE,
            )))
            if slugs:
                return slugs
        except Exception as exc:
            logger.warning("  PeoplesBank: hub discovery failed: %s", exc)
        return _FALLBACK_CATEGORIES

    # ── Per-category parsing ──────────────────────────────────────────────

    def _parse_category_page(
        self, html: str, page_url: str, card_type: str,
    ) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")
        category = _category_from_url(page_url)

        cards = soup.select("article.offer-card")
        if not cards:
            logger.debug("  PeoplesBank: no article.offer-card on %s", page_url)
            return []

        results: list[ScrapedOffer] = []
        seen: set[str] = set()

        for card in cards:
            offer = self._card_to_offer(card, category, card_type)
            if offer and offer.candidate_hash not in seen:
                seen.add(offer.candidate_hash)
                results.append(offer)

        return results

    def _card_to_offer(
        self, card: Tag, category: str, card_type: str,
    ) -> ScrapedOffer | None:
        # ── Merchant / title (.promo-short) ───────────────────────────────
        promo = card.select_one(".promo-short")
        title = clean_text(promo.get_text()) if promo else None
        if not title or len(title) < 3:
            return None

        # ── Offer details (.merchant-name) — strip the "…See more" tail ────
        meta = card.select_one(".merchant-name")
        description = None
        if meta:
            txt = clean_text(meta.get_text(" "))
            txt = re.sub(r"\.{2,}\s*see more\s*$", "", txt, flags=re.IGNORECASE).strip()
            description = txt or None

        # ── Discount: prefer the details text, fall back to the badge ──────
        badge = card.select_one(".discount-badge")
        badge_text = clean_text(badge.get_text()) if badge else ""
        discount = extract_discount(description or "") or extract_discount(badge_text)
        if not discount and badge_text:
            m = re.search(r"(\d+)\s*%", badge_text)
            if m:
                discount = f"{m.group(1)}% off"

        # ── Validity (.valid-date) — single "(21st June 2026)" OR a range
        #    "From March 1, 2026 to October 31, 2026". ──────────────────────
        vd = card.select_one(".valid-date")
        valid_from, valid_to = _parse_validity(vd.get_text()) if vd else (None, None)

        # ── Individual offer URL ──────────────────────────────────────────
        link = card.find("a", href=re.compile(r"/promotion/"))
        href = link.get("href", "") if link else ""
        source_url = (
            href if href.startswith("http")
            else f"{_BASE_URL}{href}" if href else page_safe_url(category, card_type)
        )

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts = [title]
        if description: raw_parts.append(description)
        if discount:    raw_parts.append(discount)
        if valid_to:    raw_parts.append(f"Valid to: {valid_to.isoformat()}")
        raw_parts.append(f"Category: {category}")
        raw_parts.append(f"Card: {card_type}")
        raw_text = " | ".join(raw_parts)

        # ── Confidence ────────────────────────────────────────────────────
        score = 0.55
        if discount:    score += 0.20
        if valid_to:    score += 0.15
        if valid_from:  score += 0.05
        if description: score += 0.05

        ch = generate_candidate_hash(
            source_url, title, discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )

        return ScrapedOffer(
            title=title,
            description=description,
            raw_text=truncate(raw_text, 2000),
            source_url=source_url,
            detected_merchant=title,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=ch,
        )


# ── Module helpers ────────────────────────────────────────────────────────────

def _category_from_url(url: str) -> str:
    """Extract a human-readable category name from the URL path."""
    clean = url.split("?")[0].rstrip("/")
    slug  = clean.rsplit("/", 1)[-1]
    slug  = re.sub(r"[-_](credit|debit)[_-]?card$", "", slug, flags=re.IGNORECASE)
    return slug.replace("-", " ").replace("_", " ").title() or "General"


def page_safe_url(category: str, card_type: str) -> str:
    """Fallback source URL when a card has no individual /promotion/ link."""
    return f"{_BASE_URL}/special-offers/"


# Matches "1 June 2026", "1st June 2026", and "June 1, 2026".
_DATE_RE = re.compile(
    r"(\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}|[A-Za-z]{3,}\s+\d{1,2},?\s+\d{4})"
)


def _try_date(text: str) -> date | None:
    """Parse a single date string, returning None on failure."""
    cleaned = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", text, flags=re.IGNORECASE).strip()
    try:
        return dateutil_parser.parse(cleaned, dayfirst=True, fuzzy=True).date()
    except (ValueError, OverflowError, TypeError):
        return None


def _find_dates(text: str) -> list[date]:
    """Return every parseable date found in text, in order of appearance."""
    out: list[date] = []
    for m in _DATE_RE.finditer(text):
        d = _try_date(m.group(1))
        if d:
            out.append(d)
    return out


def _parse_validity(text: str) -> tuple[date | None, date | None]:
    """
    Parse the People's Bank validity string into (valid_from, valid_to).

    Handles a date range ("From March 1, 2026 to October 31, 2026") and a
    single date ("(21st June 2026)" → valid_to only). Returns (None, None)
    when no date is present (e.g. ongoing offers).
    """
    if not text:
        return None, None
    cleaned = re.sub(r"[()]", " ", text)
    cleaned = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", cleaned, flags=re.IGNORECASE)

    if re.search(r"\bfrom\b", cleaned, re.IGNORECASE) and re.search(r"\bto\b", cleaned, re.IGNORECASE):
        before, _, after = cleaned.partition(" to ")
        starts, ends = _find_dates(before), _find_dates(after)
        vf = starts[-1] if starts else None
        vt = ends[0] if ends else None
        if vf or vt:
            return vf, vt

    dates = _find_dates(cleaned)
    if dates:
        # Single/odd format — treat the latest date as the end date.
        return (None, dates[-1])
    return None, None
