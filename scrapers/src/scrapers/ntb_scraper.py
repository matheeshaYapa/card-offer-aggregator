"""
Nations Trust Bank (NTB) promotions scraper.

Target: https://www.nationstrust.com/promotions/what-s-new

NTB organises promotions as "offer bundles" — each bundle page covers
several merchant-specific deals in a table:

  Listing card (per category page):
    <a href="/promotions/[category]/[offer-slug]">
      <img ...>
      <h3>Offer bundle title</h3>
    </a>

  Individual offer page:
    Table: Merchant | Offer details | Eligibility
    "Valid till DD Month YYYY" somewhere on the page

Categories (each has its own page of bundle links):
  what-s-new  shopping  supermarket  leisure  dining  healthcare  regional  other

Strategy:
  1. Fetch every category page to collect all unique offer bundle URLs.
  2. For each unique URL, fetch the detail page.
  3. Parse the table rows (merchant, offer, eligibility) and the validity date.
  4. One candidate per table row — giving individual merchant-level candidates.
  5. Rate-limit to 0.5 s between detail page fetches.
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

_BASE_URL = "https://www.nationstrust.com"

# All category listing pages — each contains offer bundle links
_CATEGORY_PAGES = [
    f"{_BASE_URL}/promotions/what-s-new",
    f"{_BASE_URL}/promotions/shopping",
    f"{_BASE_URL}/promotions/supermarket",
    f"{_BASE_URL}/promotions/leisure",
    f"{_BASE_URL}/promotions/dining",
    f"{_BASE_URL}/promotions/healthcare",
    f"{_BASE_URL}/promotions/regional",
    f"{_BASE_URL}/promotions/other",
]


class NTBScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """Collect all offer bundle URLs across categories, then scrape each."""
        # ── Step 1: collect every unique offer URL ─────────────────────────
        offer_urls: dict[str, str] = {}   # url → page title from listing

        for cat_url in _CATEGORY_PAGES:
            try:
                html = self.fetch_html(cat_url)
                found = self._extract_offer_links(html)
                for url, title in found.items():
                    if url not in offer_urls:
                        offer_urls[url] = title
                logger.debug(
                    "  NTB: %s → %d offer link(s)",
                    cat_url.rsplit("/", 1)[-1], len(found)
                )
            except Exception as exc:
                logger.warning("  NTB: failed to fetch category %s: %s", cat_url, exc)
            time.sleep(0.3)

        logger.info("  NTB: %d unique offer bundle URL(s) collected", len(offer_urls))

        # ── Step 2: scrape each offer detail page ─────────────────────────
        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for offer_url, listing_title in offer_urls.items():
            try:
                html = self.fetch_html(offer_url)
                page_offers = self._parse_detail_page(html, offer_url, listing_title)
                new = 0
                for offer in page_offers:
                    if offer.candidate_hash not in seen_hashes:
                        seen_hashes.add(offer.candidate_hash)
                        candidates.append(offer)
                        new += 1
                logger.debug("  NTB: %s → %d candidate(s)", offer_url.rsplit("/", 1)[-1][:40], new)
            except Exception as exc:
                logger.warning("  NTB: failed to scrape %s: %s", offer_url, exc)
            time.sleep(0.5)

        logger.info("  NTB: %d unique candidate(s) total", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:
        """Fallback — parses a single category listing page."""
        offer_links = self._extract_offer_links(html)
        candidates = []
        for url, title in offer_links.items():
            raw_text = title
            ch = generate_candidate_hash(url, title, None, None, raw_text)
            candidates.append(ScrapedOffer(
                title=title, description=None,
                raw_text=truncate(raw_text, 2000), source_url=url,
                detected_merchant=None, detected_discount=None,
                detected_valid_from=None, detected_valid_to=None,
                confidence_score=0.40, candidate_hash=ch,
            ))
        return candidates

    # ── Listing page: extract offer bundle links ──────────────────────────

    def _extract_offer_links(self, html: str) -> dict[str, str]:
        """Return {absolute_url: listing_title} for every offer bundle link."""
        soup = BeautifulSoup(html, "lxml")
        results: dict[str, str] = {}

        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            # Match /promotions/[category]/[slug] (not the category index itself)
            if not re.search(r"/promotions/[^/]+/[^/]+", href):
                continue
            full = f"{_BASE_URL}{href}" if href.startswith("/") else href
            if full in results:
                continue

            h = a.find(["h3", "h2", "h4"])
            title = clean_text(h.get_text()) if h else clean_text(a.get_text())
            if title and len(title) > 5:
                results[full] = title

        return results

    # ── Detail page: parse table rows into candidates ─────────────────────

    def _parse_detail_page(
        self, html: str, source_url: str, listing_title: str
    ) -> list[ScrapedOffer]:
        """
        NTB detail pages contain a table:
          Merchant | Offer details | Eligibility
        plus a validity date somewhere in the page body.
        One candidate per table row.
        """
        soup = BeautifulSoup(html, "lxml")

        # ── Page-level validity date ───────────────────────────────────────
        page_text = soup.get_text(separator=" ")
        dates = extract_dates(page_text)
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        # ── Category from URL path ─────────────────────────────────────────
        parts = source_url.replace(_BASE_URL, "").split("/")
        category = parts[2].replace("-", " ").title() if len(parts) >= 3 else None

        # ── Parse offer table ──────────────────────────────────────────────
        rows = self._find_offer_rows(soup)
        candidates: list[ScrapedOffer] = []

        if rows:
            for merchant, offer_text, eligibility in rows:
                if not merchant or len(merchant) < 3:
                    continue
                discount = extract_discount(offer_text) or None
                raw_parts = [merchant, offer_text]
                if eligibility: raw_parts.append(f"Eligibility: {eligibility}")
                if category:    raw_parts.append(f"Category: {category}")
                if valid_to:    raw_parts.append(f"Valid to: {valid_to.isoformat()}")
                raw_text = " | ".join(raw_parts)

                score = 0.55
                if discount:    score += 0.15
                if valid_to:    score += 0.15
                if valid_from:  score += 0.05
                if eligibility: score += 0.10

                ch = generate_candidate_hash(
                    source_url, merchant, discount,
                    valid_to.isoformat() if valid_to else None,
                    raw_text,
                )
                candidates.append(ScrapedOffer(
                    title=merchant,
                    description=offer_text[:500] if offer_text else None,
                    raw_text=truncate(raw_text, 2000),
                    source_url=source_url,
                    detected_merchant=merchant,
                    detected_discount=discount,
                    detected_valid_from=valid_from,
                    detected_valid_to=valid_to,
                    confidence_score=round(min(score, 1.0), 2),
                    candidate_hash=ch,
                ))
        else:
            # Fallback: no table found, use the listing title as a single candidate
            discount = extract_discount(listing_title) or None
            raw_text = listing_title
            if category:  raw_text += f" | Category: {category}"
            if valid_to:  raw_text += f" | Valid to: {valid_to.isoformat()}"

            ch = generate_candidate_hash(
                source_url, listing_title, discount,
                valid_to.isoformat() if valid_to else None,
                raw_text,
            )
            candidates.append(ScrapedOffer(
                title=listing_title,
                description=None,
                raw_text=truncate(raw_text, 2000),
                source_url=source_url,
                detected_merchant=None,
                detected_discount=discount,
                detected_valid_from=valid_from,
                detected_valid_to=valid_to,
                confidence_score=0.45 + (0.10 if valid_to else 0.0),
                candidate_hash=ch,
            ))

        return candidates

    def _find_offer_rows(self, soup: BeautifulSoup) -> list[tuple[str, str, str]]:
        """
        Extract rows from the offer table: (merchant, offer_text, eligibility).
        Handles both <table> markup and div-based layouts.
        """
        rows: list[tuple[str, str, str]] = []

        # ── Strategy 1: HTML <table> ──────────────────────────────────────
        for table in soup.find_all("table"):
            trows = table.find_all("tr")
            for tr in trows:
                cells = [clean_text(td.get_text()) for td in tr.find_all(["td", "th"])]
                if len(cells) >= 2 and cells[0] and len(cells[0]) > 2:
                    merchant   = cells[0]
                    offer_text = cells[1] if len(cells) > 1 else ""
                    eligibility = cells[2] if len(cells) > 2 else ""
                    # Skip header rows
                    if merchant.lower() in ("merchant", "offer", "eligibility"):
                        continue
                    rows.append((merchant, offer_text, eligibility))
            if rows:
                return rows

        # ── Strategy 2: definition-list or repeated div blocks ───────────
        # Some banks use <dt>/<dd> pairs or repeating divs
        for dl in soup.find_all("dl"):
            dts = dl.find_all("dt")
            dds = dl.find_all("dd")
            for dt, dd in zip(dts, dds):
                merchant   = clean_text(dt.get_text())
                offer_text = clean_text(dd.get_text())
                if merchant and len(merchant) > 2:
                    rows.append((merchant, offer_text, ""))
            if rows:
                return rows

        return rows
