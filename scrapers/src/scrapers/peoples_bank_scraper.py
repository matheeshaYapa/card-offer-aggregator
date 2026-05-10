"""
People's Bank promotions scraper.

Target: https://www.peoplesbank.lk/special-offers/

People's Bank uses a category-based structure. The main page is just a nav
hub — offers live on individual category sub-pages for both credit and debit
cards. Each category page is server-rendered HTML with offer cards:

  <div class="promotion-item">
    <div class="discount-badge">50%</div>
    <a href="/promotion/[offer-slug]/"><h3>Merchant Name</h3></a>
    <p>From April 15, 2026 to July 15, 2026</p>
    <p>Call Us: 0702354466</p>
  </div>

Strategy:
  1. Iterate all 19 known category URLs (credit + debit card types).
  2. For each page, extract every promotion card.
  3. Use the individual /promotion/[slug]/ URL as source_url.
  4. Extract merchant (h3), discount (badge), dates (p text).

Adding new categories:
  Append to _CATEGORY_URLS with the confirmed URL from the site.
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

_BASE_URL  = "https://www.peoplesbank.lk"
_HUB_URL   = f"{_BASE_URL}/special-offers/"

# All confirmed category URLs (from DevTools inspection, 2026-05-09).
# Case-sensitive slug values are used as-found from the site.
_CATEGORY_URLS: list[str] = [
    # ── Credit card ───────────────────────────────────────────────────────
    f"{_BASE_URL}/promotion-category/leisure/?cardType=credit_card",
    f"{_BASE_URL}/promotion-category/restaurants/?cardType=credit_card",
    f"{_BASE_URL}/promotion-category/online-stores/?cardType=credit_card",
    f"{_BASE_URL}/promotion-category/home-care-electronics/?cardType=credit_card",
    f"{_BASE_URL}/promotion-category/supermarkets/?cardType=credit_card",
    f"{_BASE_URL}/promotion-category/jewellers/?cardType=credit_card",
    f"{_BASE_URL}/promotion-category/auto-mobile/?cardType=credit_card",
    f"{_BASE_URL}/promotion-category/travel/?cardType=credit_card",
    f"{_BASE_URL}/promotion-category/mastercard/?cardType=credit_card",
    f"{_BASE_URL}/promotion-category/visa/?cardType=credit_card",
    f"{_BASE_URL}/buy-anything-anywhere/?cardType=credit_card",
    f"{_BASE_URL}/installments/?cardType=credit_card",
    # ── Debit card ────────────────────────────────────────────────────────
    f"{_BASE_URL}/leisure-debit-card/?cardType=debit_card",
    f"{_BASE_URL}/online-stores-debit-card/?cardType=debit_card",
    f"{_BASE_URL}/electronics-debit-card/?cardType=debit_card",
    f"{_BASE_URL}/restaurants-debit-card/",
    f"{_BASE_URL}/jewelry-debit-card/?cardType=debit_card",
    f"{_BASE_URL}/healthcare-debit-card/?cardType=debit_card",
    f"{_BASE_URL}/debit-card-others/?cardType=debit_card",
]

# CSS selectors tried in priority order for individual offer cards
_CARD_SELECTORS = [
    ".promotion-item",
    ".promo-item",
    "[class*='promotion-item']",
    "[class*='promo-item']",
    "article.offer",
    ".offer-card",
]


class PeoplesBankScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """Override: fetch every category URL and merge unique candidates."""
        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for url in _CATEGORY_URLS:
            try:
                html = self.fetch_html(url)
                page_offers = self._parse_category_page(html, url)
                new_count = 0
                for offer in page_offers:
                    if offer.candidate_hash not in seen_hashes:
                        seen_hashes.add(offer.candidate_hash)
                        candidates.append(offer)
                        new_count += 1
                label = _label(url)
                logger.info("  PeoplesBank: %-30s → %d candidate(s)", label, new_count)
            except Exception as exc:
                logger.warning("  PeoplesBank: failed for %s: %s", url, exc)

            time.sleep(0.5)   # polite rate limit

        logger.info("  PeoplesBank: %d unique candidate(s) total", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:
        """Fallback used when BaseScraper.run() calls parse(html)."""
        return self._parse_category_page(html, self.source_url)

    # ── Per-category parsing ──────────────────────────────────────────────

    def _parse_category_page(self, html: str, page_url: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")
        card_type = "debit" if "debit" in page_url.lower() else "credit"
        category  = _category_from_url(page_url)

        # ── Strategy 1: CSS selector matching ─────────────────────────────
        blocks: list[Tag] = []
        for selector in _CARD_SELECTORS:
            found = soup.select(selector)
            if found:
                logger.debug(
                    "  PeoplesBank: selector '%s' matched %d blocks", selector, len(found)
                )
                blocks = found
                break

        if blocks:
            return self._extract_from_blocks(blocks, category, card_type, page_url)

        # ── Strategy 2: /promotion/ links ─────────────────────────────────
        promo_links = soup.find_all("a", href=re.compile(r"/promotion/"))
        if promo_links:
            logger.debug(
                "  PeoplesBank: found %d /promotion/ links on %s", len(promo_links), page_url
            )
            return self._extract_from_promo_links(promo_links, category, card_type)

        logger.debug("  PeoplesBank: no content found for %s", page_url)
        return []

    # ── Extraction helpers ────────────────────────────────────────────────

    def _extract_from_blocks(
        self,
        blocks: list[Tag],
        category: str,
        card_type: str,
        page_url: str,
    ) -> list[ScrapedOffer]:
        results: list[ScrapedOffer] = []
        seen: set[str] = set()

        for block in blocks:
            offer = self._card_to_offer(block, category, card_type, page_url)
            if offer and offer.candidate_hash not in seen:
                seen.add(offer.candidate_hash)
                results.append(offer)

        return results

    def _extract_from_promo_links(
        self,
        links: list[Tag],
        category: str,
        card_type: str,
    ) -> list[ScrapedOffer]:
        """Fallback: each <a href='/promotion/slug/'> link contains or is near a merchant name."""
        results: list[ScrapedOffer] = []
        seen_urls: set[str] = set()
        seen_hashes: set[str] = set()

        for link in links:
            href = link.get("href", "")
            source_url = f"{_BASE_URL}{href}" if href.startswith("/") else href
            if source_url in seen_urls:
                continue
            seen_urls.add(source_url)

            # Merchant from heading inside the link or nearby text
            h = link.find(["h3", "h2", "h4"])
            title = clean_text(h.get_text()) if h else clean_text(link.get_text())
            if not title or len(title) < 3:
                continue

            # Discount from parent element
            parent = link.parent
            discount: str | None = None
            if parent:
                badge = parent.find(
                    class_=re.compile(r"discount|badge|percent|off", re.IGNORECASE)
                )
                if badge:
                    discount = clean_text(badge.get_text()) or None

            raw_text = " | ".join(
                filter(None, [title, discount, f"Category: {category}", f"Card: {card_type}"])
            )
            ch = generate_candidate_hash(source_url, title, discount, None, raw_text)
            if ch in seen_hashes:
                continue
            seen_hashes.add(ch)

            results.append(ScrapedOffer(
                title=title,
                description=None,
                raw_text=truncate(raw_text, 2000),
                source_url=source_url,
                detected_merchant=title,
                detected_discount=discount,
                detected_valid_from=None,
                detected_valid_to=None,
                confidence_score=0.55 + (0.20 if discount else 0.0),
                candidate_hash=ch,
            ))

        return results

    def _card_to_offer(
        self,
        block: Tag,
        category: str,
        card_type: str,
        fallback_url: str,
    ) -> ScrapedOffer | None:
        # ── Merchant / title ──────────────────────────────────────────────
        h = block.find(["h3", "h2", "h4", "h5"])
        title = clean_text(h.get_text()) if h else None
        if not title or len(title) < 3:
            return None

        # ── Discount ──────────────────────────────────────────────────────
        badge = block.find(
            class_=re.compile(r"discount|badge|percent|off", re.IGNORECASE)
        )
        discount_raw = clean_text(badge.get_text()) if badge else ""
        discount = extract_discount(discount_raw) or (discount_raw or None)

        # ── Dates from paragraph text ─────────────────────────────────────
        date_text = ""
        for p in block.find_all("p"):
            text = p.get_text(strip=True)
            if re.search(r"(from|till|valid|to |2026|2027)", text, re.IGNORECASE):
                date_text = clean_text(text)
                break

        dates    = extract_dates(date_text) if date_text else {}
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        # ── Source URL (individual offer page) ────────────────────────────
        link = block.find("a", href=re.compile(r"/promotion/"))
        source_url = fallback_url
        if link:
            href = link.get("href", "")
            source_url = f"{_BASE_URL}{href}" if href.startswith("/") else href

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts = [title]
        if discount:   raw_parts.append(discount)
        if date_text:  raw_parts.append(date_text)
        raw_parts.append(f"Category: {category}")
        raw_parts.append(f"Card: {card_type}")
        raw_text = " | ".join(raw_parts)

        # ── Confidence ────────────────────────────────────────────────────
        score = 0.55
        if discount:    score += 0.20
        if valid_to:    score += 0.15
        if valid_from:  score += 0.05

        ch = generate_candidate_hash(
            source_url, title, discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )

        return ScrapedOffer(
            title=title,
            description=None,
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
    # Remove known suffixes
    slug = re.sub(r"[-_](credit|debit)[_-]?card$", "", slug, flags=re.IGNORECASE)
    return slug.replace("-", " ").replace("_", " ").title() or "General"


def _label(url: str) -> str:
    """Short label for logging."""
    path = url.split("peoplesbank.lk", 1)[-1].split("?")[0].strip("/")
    return path[:30]
