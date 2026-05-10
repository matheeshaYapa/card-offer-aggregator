"""
Amana Bank promotions scraper.

Target: https://www.amanabank.lk/personal/services/visa-debit-card/offers/

Server-rendered HTML. Amana Bank only issues Visa Debit Cards — no credit cards.

All offers are listed on the main page in <li> elements. Each offer has:

  <li>
    <img src="/images/.../logo.jpg" alt="Merchant Name">
    <div class="offer-details">
      <h3>Merchant Name</h3>
      <p>Up to 35% Off for Amana Bank Debit Card Holders</p>
      <p><strong>Location/s:</strong> Colombo City Centre, ...</p>
      <p><strong>Offer Period Valid on:</strong> 25th May 2026 to 31st Dec 2026</p>
    </div>
  </li>

Category pages (for category context):
  /personal/services/visa-debit-card/offers/dining.html
  /personal/services/visa-debit-card/offers/clothing-and-retail.html
  ... (9 categories total)

Strategy:
  1. Scrape each category page so each offer is tagged with its category.
  2. Fall back to the main "All Offers" page if a category page fails.
  3. Parse div.offer-details inside each <li> for the offer data.
  4. "Offer Period Valid on:" paragraph contains the date range.
  5. date_extractor.py handles "25th May 2026 to 31st Dec 2026" natively.
"""
import re
import time

from bs4 import BeautifulSoup, Tag

from src.extractors.date_extractor import extract_dates
from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_BASE_URL  = "https://www.amanabank.lk"
_MAIN_URL  = f"{_BASE_URL}/personal/services/visa-debit-card/offers/"

# Category pages — each shows only the offers in that category.
# Scraping per-category gives us the category label for each candidate.
_CATEGORY_PAGES: list[tuple[str, str]] = [
    (f"{_BASE_URL}/personal/services/visa-debit-card/offers/dining.html",                  "Dining"),
    (f"{_BASE_URL}/personal/services/visa-debit-card/offers/clothing-and-retail.html",     "Clothing & Retail"),
    (f"{_BASE_URL}/personal/services/visa-debit-card/offers/supermarket.html",             "Supermarket"),
    (f"{_BASE_URL}/personal/services/visa-debit-card/offers/leisure-and-hospitality.html", "Leisure & Hospitality"),
    (f"{_BASE_URL}/personal/services/visa-debit-card/offers/healthcare-and-wellness.html", "Healthcare & Wellness"),
    (f"{_BASE_URL}/personal/services/visa-debit-card/offers/lifestyle-and-others.html",    "Lifestyle & Others"),
    (f"{_BASE_URL}/personal/services/visa-debit-card/offers/visa.html",                    "Visa Global Offers"),
    (f"{_BASE_URL}/personal/services/visa-debit-card/offers/amana-kids.html",              "Amana Kids"),
    (f"{_BASE_URL}/personal/services/visa-debit-card/offers/prestige-card-offers.html",    "Prestige Card Offers"),
]

# Paragraph text patterns to skip (location, contact, website)
_SKIP_PARA_RE = re.compile(
    r"^(?:location|contact|website|call|tel|phone|visit|reservations?|"
    r"for\s+more|terms?\s*&|t\s*&\s*c|amana\s+bank\s+debit\s+card\s+holders?)\b",
    re.IGNORECASE,
)


class AmanaScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """Scrape each category page; fall back to main page if all fail."""
        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()
        any_success = False

        for url, category in _CATEGORY_PAGES:
            try:
                html = self.fetch_html(url)
                page_offers = self._parse_page(html, url, category)
                new = 0
                for offer in page_offers:
                    if offer.candidate_hash not in seen_hashes:
                        seen_hashes.add(offer.candidate_hash)
                        candidates.append(offer)
                        new += 1
                if new:
                    any_success = True
                logger.info("  Amana: %-28s → %d candidate(s)", category, new)
            except Exception as exc:
                logger.warning("  Amana: failed for %s: %s", category, exc)
            time.sleep(0.4)

        # Fallback: if all category pages failed, try the main page
        if not any_success:
            logger.info("  Amana: all category pages failed — trying main page")
            try:
                html = self.fetch_html(_MAIN_URL)
                page_offers = self._parse_page(html, _MAIN_URL, None)
                for offer in page_offers:
                    if offer.candidate_hash not in seen_hashes:
                        seen_hashes.add(offer.candidate_hash)
                        candidates.append(offer)
            except Exception as exc:
                logger.error("  Amana: main page also failed: %s", exc)

        logger.info("  Amana: %d unique candidate(s) total", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:
        """Fallback — called by BaseScraper.run() if needed."""
        return self._parse_page(html, self.source_url, None)

    # ── Page parsing ──────────────────────────────────────────────────────

    def _parse_page(
        self,
        html: str,
        page_url: str,
        category: str | None,
    ) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")

        # Each offer has a div.offer-details inside a <li>
        offer_divs = soup.find_all("div", class_="offer-details")

        if not offer_divs:
            logger.debug("  Amana: no div.offer-details on %s", page_url)
            return []

        results: list[ScrapedOffer] = []
        seen: set[str] = set()

        for div in offer_divs:
            offer = self._extract_offer(div, category, page_url)
            if offer and offer.candidate_hash not in seen:
                seen.add(offer.candidate_hash)
                results.append(offer)

        return results

    # ── Per-offer extraction ──────────────────────────────────────────────

    def _extract_offer(
        self,
        div: Tag,
        category: str | None,
        source_url: str,
    ) -> ScrapedOffer | None:
        # ── Merchant name from <h3> ───────────────────────────────────────
        h3 = div.find(["h3", "h4", "h2"])
        merchant = clean_text(h3.get_text()) if h3 else None
        if not merchant or len(merchant) < 2:
            return None
        title = merchant

        # ── Paragraphs: discount description and dates ────────────────────
        description: str | None = None
        date_text   = ""

        for p in div.find_all("p"):
            raw = clean_text(p.get_text())
            if not raw or len(raw) < 4:
                continue

            # Date paragraph — "Offer Period Valid on: DATE to DATE"
            if re.search(r"offer\s+period", raw, re.IGNORECASE):
                # Strip the label, keep just the date range
                date_text = re.sub(r"^[^:]+:\s*", "", raw).strip()
                continue

            # Skip location / contact / terms paragraphs
            if _SKIP_PARA_RE.match(raw):
                continue

            # First remaining paragraph = offer description
            if not description:
                description = raw

        # ── Dates ─────────────────────────────────────────────────────────
        dates      = extract_dates(date_text) if date_text else {}
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        # ── Discount ──────────────────────────────────────────────────────
        discount = extract_discount(description or title) or None

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts = [title]
        if description: raw_parts.append(description)
        if date_text:   raw_parts.append(f"Period: {date_text}")
        if category:    raw_parts.append(f"Category: {category}")
        raw_parts.append("Card: Visa Debit")
        raw_text = " | ".join(raw_parts)

        # ── Confidence ────────────────────────────────────────────────────
        score = 0.60
        if discount:    score += 0.15
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
            detected_merchant=merchant,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=ch,
        )
