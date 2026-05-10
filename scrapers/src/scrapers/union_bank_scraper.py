"""
Union Bank of Colombo credit card offers scraper.

Target: https://www.unionb.com/credit-cards-offers/

WordPress site, server-rendered. Offer listing cards use:

  <div class="offer-card">
    <a href="https://www.unionb.com/offer/[slug]/">
      <img src="...">
      <h3>Merchant Name</h3>
      <p>30% OFF</p>
      <p>9 & 10 May</p>          ← brief date, no year
    </a>
  </div>

Individual offer detail pages (followed for full data):
  <h1>Merchant Name</h1>
  <p>30% off at Merchant with Union Bank Credit Cards</p>
  <p>Offer valid on 9th & 10th May 2026</p>   ← full date with year
  <h3>Terms & Conditions</h3>
  <ul><li>...</li></ul>

Strategy:
  1. Paginate the listing pages (/credit-cards-offers/ + /page/2/ etc.)
  2. Collect all unique offer detail page URLs from div.offer-card a[href].
  3. Fetch each detail page for the full date, description, and eligibility.
  4. No infinite pagination — stop when a page returns no new offer cards.
"""
import re
import time
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from src.extractors.date_extractor import extract_dates
from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_BASE_URL  = "https://www.unionb.com"
_LIST_URL  = f"{_BASE_URL}/credit-cards-offers/"

# Paragraphs to skip on detail pages (phone, address, social, T&C headers)
_SKIP_DETAIL_RE = re.compile(
    r"^(?:terms?\s*&|t\s*&\s*c|address|phone|call|tel:|website:|promo\s*code|"
    r"maximum\s+discount|minimum\s+bill|one\s+transaction|valid\s+for\s+union)",
    re.IGNORECASE,
)


class UnionBankScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """Paginate listing pages, then scrape each individual offer page."""
        offer_urls = self._collect_offer_urls()
        logger.info("  UnionBank: found %d unique offer URL(s)", len(offer_urls))

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for i, url in enumerate(offer_urls, 1):
            try:
                html = self.fetch_html(url)
                offer = self._parse_detail_page(html, url)
                if offer and offer.candidate_hash not in seen_hashes:
                    seen_hashes.add(offer.candidate_hash)
                    candidates.append(offer)
                logger.debug(
                    "  UnionBank: [%d/%d] %s → %s",
                    i, len(offer_urls),
                    url.rsplit("/", 2)[-2],
                    "OK" if offer else "skip",
                )
            except Exception as exc:
                logger.warning("  UnionBank: failed to scrape %s: %s", url, exc)
            time.sleep(0.3)

        logger.info("  UnionBank: %d candidate(s) total", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:
        """Fallback — extracts from a listing page without following detail links."""
        soup = BeautifulSoup(html, "lxml")
        candidates: list[ScrapedOffer] = []
        seen: set[str] = set()
        for card in soup.find_all("div", class_="offer-card"):
            offer = self._extract_from_listing_card(card)
            if offer and offer.candidate_hash not in seen:
                seen.add(offer.candidate_hash)
                candidates.append(offer)
        return candidates

    # ── Listing pagination ────────────────────────────────────────────────

    def _collect_offer_urls(self) -> list[str]:
        """Paginate through all listing pages and return unique offer detail URLs."""
        seen: set[str] = set()
        urls: list[str] = []
        page_num = 1

        while True:
            page_url = (
                _LIST_URL
                if page_num == 1
                else f"{_LIST_URL}page/{page_num}/"
            )
            try:
                html = self.fetch_html(page_url)
            except Exception as exc:
                logger.warning("  UnionBank: failed to fetch listing page %d: %s", page_num, exc)
                break

            soup = BeautifulSoup(html, "lxml")
            cards = soup.find_all("div", class_="offer-card")
            if not cards:
                logger.debug("  UnionBank: no offer-cards on page %d — stopping", page_num)
                break

            new_on_page = 0
            for card in cards:
                a = card.find("a", href=True)
                if a:
                    href = a["href"]
                    full = href if href.startswith("http") else urljoin(_BASE_URL, href)
                    if full not in seen:
                        seen.add(full)
                        urls.append(full)
                        new_on_page += 1

            logger.debug("  UnionBank: listing page %d → %d new URL(s)", page_num, new_on_page)

            # Stop if no new URLs found on this page
            if new_on_page == 0:
                break

            # Check for next page link
            next_link = soup.find("a", string=re.compile(r"next", re.IGNORECASE))
            if not next_link:
                break

            page_num += 1
            time.sleep(0.3)

        return urls

    # ── Detail page parsing ───────────────────────────────────────────────

    def _parse_detail_page(self, html: str, source_url: str) -> ScrapedOffer | None:
        soup = BeautifulSoup(html, "lxml")

        # ── Title: first <h1> in content ──────────────────────────────────
        h1 = soup.find("h1")
        title = clean_text(h1.get_text()) if h1 else None
        if not title or len(title) < 3:
            # fallback to <h2>
            h2 = soup.find("h2")
            title = clean_text(h2.get_text()) if h2 else None
        if not title or len(title) < 3:
            return None

        # ── Content paragraphs ────────────────────────────────────────────
        # Skip nav/header/footer elements first
        for tag in soup(["nav", "header", "footer", "aside"]):
            tag.decompose()

        description: str | None = None
        date_text   = ""

        for p in soup.find_all("p"):
            text = clean_text(p.get_text())
            if not text or len(text) < 5:
                continue
            if _SKIP_DETAIL_RE.match(text):
                continue

            # Date paragraph — contains year or "valid on/till/until"
            if re.search(r"\b20[2-9]\d\b|valid\s+on|valid\s+till|till\s+\d|every\s+week", text, re.IGNORECASE):
                if not date_text:
                    date_text = text
                continue

            # First remaining paragraph = main offer description
            if not description and len(text) > 10:
                description = text

        # ── Dates ─────────────────────────────────────────────────────────
        dates      = extract_dates(date_text) if date_text else {}
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        # ── Discount ──────────────────────────────────────────────────────
        discount = extract_discount(description or title) or None

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts = [title]
        if description: raw_parts.append(description)
        if date_text:   raw_parts.append(date_text)
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
            detected_merchant=title,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=ch,
        )

    def _extract_from_listing_card(self, card: Tag) -> ScrapedOffer | None:
        """Extract from listing card only (fallback — no year in date)."""
        a = card.find("a", href=True)
        if not a:
            return None
        href = a["href"]
        source_url = href if href.startswith("http") else urljoin(_BASE_URL, href)

        h = a.find(["h3", "h2"])
        title = clean_text(h.get_text()) if h else None
        if not title or len(title) < 3:
            return None

        paras = [clean_text(p.get_text()) for p in a.find_all("p") if p.get_text(strip=True)]
        discount_raw = paras[0] if paras else ""
        discount = extract_discount(discount_raw) or (discount_raw or None)

        raw_text = " | ".join(filter(None, [title, discount]))
        ch = generate_candidate_hash(source_url, title, discount, None, raw_text)

        return ScrapedOffer(
            title=title, description=None,
            raw_text=truncate(raw_text, 2000), source_url=source_url,
            detected_merchant=title, detected_discount=discount,
            detected_valid_from=None, detected_valid_to=None,
            confidence_score=0.50 + (0.20 if discount else 0.0),
            candidate_hash=ch,
        )
