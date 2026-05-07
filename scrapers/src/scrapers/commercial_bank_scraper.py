"""
Commercial Bank of Ceylon promotions scraper.

Target: https://www.combank.lk/rewards-promotions

The page is server-rendered HTML (Drupal-style CMS, not a SPA).
Each promotion is a clickable card wrapped in an <a> tag:

  <a href="/rewards-promotion/[category]/[offer-slug]">
    <div>Up to 20% Off</div>       ← discount text
    <div>Food & Restaurants</div>  ← category label
    <h3>Enjoy dining at …</h3>     ← offer title
    <p>Offer valid till DATE</p>   ← validity
  </a>

Strategy:
  1. Find all <a href="/rewards-promotion/…"> links on the listing page.
  2. For each link, extract: title (h3/h2), discount (first div), validity (p/date text).
  3. Derive category from the URL path segment.
  4. Use the canonical per-offer URL as source_url for deduplication and admin link-through.

Fallback: if no links are found with the expected pattern, run the generic block parser.
"""
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from src.extractors.date_extractor import extract_dates
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, is_meaningful, truncate

logger = get_logger(__name__)

_BASE_URL = "https://www.combank.lk"
_LIST_URL = "https://www.combank.lk/rewards-promotions"

_DISCOUNT_RE = re.compile(
    r"(?:up\s+to\s+)?"
    r"(?:"
    r"\d+(?:\.\d+)?\s*%(?:\s+(?:off|discount|cashback|savings?))?"
    r"|\d+\s+months?\s+(?:0%|interest\s+free)"
    r"|Rs\.?\s*[\d,]+(?:\s*(?:off|back))?"
    r")",
    re.IGNORECASE,
)


class CommercialBankScraper(BaseScraper):

    def parse(self, html: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")

        # ── Strategy 1: offer card links ──────────────────────────────────
        # Each individual offer page lives at /rewards-promotion/[cat]/[slug]
        # The path always has at least 4 segments: '' / 'rewards-promotion' / cat / slug
        offer_links: list[Tag] = []
        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            # Normalise to absolute
            if href.startswith("/"):
                href = _BASE_URL + href
            elif not href.startswith("http"):
                href = urljoin(_LIST_URL, href)

            # Must contain /rewards-promotion/ and have a slug after the category
            if "/rewards-promotion/" in href and href.count("/") >= 5:
                a["_abs_href"] = href   # stash the absolute URL on the tag
                offer_links.append(a)

        # Deduplicate by href
        seen_hrefs: set[str] = set()
        unique_links: list[Tag] = []
        for a in offer_links:
            href = a.get("_abs_href", "")
            if href not in seen_hrefs:
                seen_hrefs.add(href)
                unique_links.append(a)

        if unique_links:
            logger.info(
                "  ComBank: found %d unique offer link(s) via href pattern", len(unique_links)
            )
            return self._extract_from_links(unique_links)

        # ── Strategy 2: generic block parser ─────────────────────────────
        logger.info("  ComBank: no href-pattern links found, falling back to generic parser")
        return self._generic_parse(html)

    # ── Per-link extraction ───────────────────────────────────────────────

    def _extract_from_links(self, links: list[Tag]) -> list[ScrapedOffer]:
        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for link in links:
            offer = self._extract_from_link_tag(link)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        logger.info("  ComBank: extracted %d candidate(s)", len(candidates))
        return candidates

    def _extract_from_link_tag(self, link: Tag) -> ScrapedOffer | None:
        """Parse one offer card <a> element into a ScrapedOffer."""
        canonical_url: str = link.get("_abs_href") or link.get("href", _LIST_URL)

        # ── Title: h3 > h2 > h4 > longest text chunk ─────────────────────
        title_tag = link.find(["h3", "h2", "h4", "h5"])
        title: str | None = None
        if title_tag:
            title = clean_text(title_tag.get_text())
        else:
            # Collect all text nodes, prefer the longest meaningful one
            chunks = [clean_text(t) for t in link.stripped_strings if len(t.strip()) > 15]
            title = chunks[0] if chunks else None

        if not title or len(title) < 8 or not is_meaningful(title, min_words=3):
            return None

        full_text = clean_text(link.get_text(separator=" "))

        # ── Discount ──────────────────────────────────────────────────────
        discount: str | None = None
        m = _DISCOUNT_RE.search(full_text)
        if m:
            discount = clean_text(m.group(0))

        # ── Dates (use the shared date extractor) ─────────────────────────
        dates = extract_dates(full_text)
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        # ── Category from URL path ────────────────────────────────────────
        # URL: /rewards-promotion/food-restaurants/some-slug
        #  segments after split: ['', 'rewards-promotion', 'food-restaurants', 'some-slug']
        path_parts = canonical_url.replace(_BASE_URL, "").split("/")
        category: str | None = None
        if len(path_parts) >= 3 and path_parts[2]:
            category = path_parts[2].replace("-", " ").title()

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts: list[str] = [title]
        if discount:
            raw_parts.append(discount)
        if category:
            raw_parts.append(f"Category: {category}")
        if valid_to:
            raw_parts.append(f"Valid to: {valid_to.isoformat()}")
        raw_text = " | ".join(raw_parts)

        # ── Confidence ────────────────────────────────────────────────────
        score = 0.50
        if discount:
            score += 0.25
        if valid_to:
            score += 0.15
        if valid_from:
            score += 0.05
        if category:
            score += 0.05

        candidate_hash = generate_candidate_hash(
            canonical_url,
            title,
            discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )

        return ScrapedOffer(
            title=title,
            description=None,
            raw_text=truncate(raw_text, 2000),
            source_url=canonical_url,   # direct link to this specific offer
            detected_merchant=None,     # merchant name is embedded in the title for ComBank
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=candidate_hash,
        )
