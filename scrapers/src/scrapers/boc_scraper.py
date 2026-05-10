"""
Bank of Ceylon (BOC) promotions scraper.

Target: https://www.boc.lk/personal-banking/card-offers

The page is server-rendered HTML. All offers across all categories are
listed on the single main page. Each offer is an <a> tag linking to an
individual offer detail page:

  /personal-banking/card-offers/[category-slug]/[merchant-slug]/product

Card structure on the listing page:
  <a href="/personal-banking/card-offers/...">
    <img src="..." alt="...">
    <h4>[DISCOUNT e.g. "40% OFF"]</h4>
    <h4>[MERCHANT NAME e.g. "Rajarata Hotel"]</h4>
    <p>Expiration date : 30 Jun 2026</p>
    <p>Read More</p>
  </a>

Individual offer detail page has: h1/h2 title, full discount description,
validity period (start + end), and terms.

Strategy:
  1. Fetch the listing page.
  2. Find every <a href=".../product"> link.
  3. Extract discount (first h4), merchant (second h4), expiry (p with "Expiration"),
     and category from the URL path segment.
  4. Use the individual offer URL as source_url so the admin can link through.
"""
import re

from bs4 import BeautifulSoup, Tag

from src.extractors.date_extractor import extract_dates
from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_BASE_URL  = "https://www.boc.lk"
_LIST_URL  = f"{_BASE_URL}/personal-banking/card-offers"

# URL segment that identifies an individual offer page
_OFFER_PATH_PATTERN = re.compile(r"/personal-banking/card-offers/[^/]+/[^/]+/product$")


class BOCScraper(BaseScraper):

    def parse(self, html: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")

        # Find every offer card link
        offer_links: list[Tag] = []
        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            full = f"{_BASE_URL}{href}" if href.startswith("/") else href
            if _OFFER_PATH_PATTERN.search(full):
                a["_full_href"] = full
                offer_links.append(a)

        if not offer_links:
            logger.info("  BOC: no offer links found — using generic parser")
            return self._generic_parse(html)

        logger.info("  BOC: found %d offer link(s)", len(offer_links))

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()
        seen_urls: set[str] = set()

        for link in offer_links:
            offer_url: str = link.get("_full_href", "")
            if not offer_url or offer_url in seen_urls:
                continue
            seen_urls.add(offer_url)

            offer = self._extract_from_card(link, offer_url)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        logger.info("  BOC: extracted %d candidate(s)", len(candidates))
        return candidates

    # ── Per-card extraction ───────────────────────────────────────────────

    def _extract_from_card(self, link: Tag, source_url: str) -> ScrapedOffer | None:
        headings = link.find_all(["h1", "h2", "h3", "h4", "h5"])
        texts = [clean_text(h.get_text()) for h in headings if h.get_text(strip=True)]

        discount: str | None = None
        merchant: str | None = None

        for text in texts:
            if not text:
                continue
            # Looks like a discount: contains %, "off", "plan", numeric
            looks_like_discount = bool(
                re.search(r"%|off|plan|free|cashback|instalment|installment", text, re.IGNORECASE)
            )
            if discount is None and looks_like_discount:
                discount = text
            elif merchant is None and not looks_like_discount:
                merchant = text
            if discount and merchant:
                break

        # Fallback: merchant from URL slug (/card-offers/category/merchant/product)
        if not merchant:
            parts = source_url.rstrip("/").split("/")
            if len(parts) >= 2:
                merchant = parts[-2].replace("-", " ").title()

        if not merchant or len(merchant) < 3:
            return None

        title = merchant   # company name is the offer subject

        # ── Expiry date ───────────────────────────────────────────────────
        expiry_text = ""
        for p in link.find_all("p"):
            raw = clean_text(p.get_text())
            if re.search(r"expir|valid|date|till|from", raw, re.IGNORECASE):
                expiry_text = raw
                break

        # ── Category from URL ─────────────────────────────────────────────
        # /personal-banking/card-offers/[category]/[merchant]/product
        url_parts = source_url.replace(_BASE_URL, "").split("/")
        # url_parts: ['', 'personal-banking', 'card-offers', 'category', 'merchant', 'product']
        category: str | None = None
        if len(url_parts) >= 4 and url_parts[3]:
            category = url_parts[3].replace("-", " ").title()

        # ── Dates ─────────────────────────────────────────────────────────
        combined_text = " ".join(filter(None, [expiry_text, title, discount]))
        dates = extract_dates(combined_text)
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        # ── Discount cleanup ──────────────────────────────────────────────
        if discount:
            refined = extract_discount(discount)
            discount = refined or discount

        # ── raw_text ──────────────────────────────────────────────────────
        raw_parts = [title]
        if discount:   raw_parts.append(discount)
        if expiry_text: raw_parts.append(expiry_text)
        if category:   raw_parts.append(f"Category: {category}")
        raw_text = " | ".join(raw_parts)

        # ── Confidence ────────────────────────────────────────────────────
        score = 0.55
        if discount:    score += 0.20
        if valid_to:    score += 0.15
        if valid_from:  score += 0.05
        if category:    score += 0.05

        candidate_hash = generate_candidate_hash(
            source_url, title, discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )

        return ScrapedOffer(
            title=title,
            description=None,
            raw_text=truncate(raw_text, 2000),
            source_url=source_url,
            detected_merchant=merchant,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=candidate_hash,
        )
