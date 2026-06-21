"""
Nations Trust Bank (NTB) promotions scraper.

Target: https://www.nationstrust.com/promotions

NTB organises promotions as "offer bundles". As of 2026-06 the site uses a
FLAT URL scheme — every bundle lives directly under /promotions/<slug> (the
older /promotions/<category>/<slug> nesting is gone). The single /promotions
listing page links to every bundle.

  Listing page (/promotions):
    <a href="/promotions/[offer-slug]"> … </a>   (one path segment)

  Individual offer page (/promotions/[offer-slug]):
    <h1>Bundle title</h1>
    Table: Merchant | Offer | Eligibility
    Each Eligibility cell carries its own "Valid till DD Month YYYY".

Strategy:
  1. Fetch the /promotions listing page and collect every flat offer link.
  2. For each unique URL, fetch the detail page.
  3. Parse the table rows (merchant, offer, eligibility); read the validity
     date PER ROW from its eligibility cell.
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
_LISTING_URL = f"{_BASE_URL}/promotions"

# Flat /promotions/<slug> links that are NOT real offer bundles.
_NON_OFFER_SLUGS = {
    "general-terms-and-condition-for-offers",
    "what-s-new", "shopping", "supermarket", "leisure", "dining",
    "healthcare", "regional", "other", "wellness", "travel",
}

# A flat offer link: /promotions/<slug> with exactly one path segment.
_OFFER_LINK_RE = re.compile(
    r"^(?:https?://(?:www\.)?nationstrust\.com)?/promotions/([^/?#]+)/?$",
    re.IGNORECASE,
)


class NTBScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """Collect all offer bundle URLs from /promotions, then scrape each."""
        # ── Step 1: collect every unique offer URL ─────────────────────────
        offer_urls: dict[str, str] = {}   # url → page title from listing

        # Prefer the configured source URL, fall back to the canonical listing.
        listing_candidates = [self.source_url, _LISTING_URL]
        for listing in listing_candidates:
            if not listing:
                continue
            try:
                html = self.fetch_html(listing)
                offer_urls = self._extract_offer_links(html)
                if offer_urls:
                    break
            except Exception as exc:
                logger.warning("  NTB: failed to fetch listing %s: %s", listing, exc)

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
        """Return {absolute_url: listing_title} for every flat offer bundle link."""
        soup = BeautifulSoup(html, "lxml")
        results: dict[str, str] = {}

        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            m = _OFFER_LINK_RE.match(href.strip())
            if not m:
                continue
            slug = m.group(1).lower()
            if slug in _NON_OFFER_SLUGS:
                continue

            full = f"{_BASE_URL}/promotions/{m.group(1)}"
            if full in results:
                continue

            h = a.find(["h3", "h2", "h4"])
            title = clean_text(h.get_text()) if h else clean_text(a.get_text())
            # Listing anchors are often image-only; fall back to a slug-derived
            # title (the detail page's <h1> is the authoritative title anyway).
            if not title or len(title) < 5:
                title = slug.replace("-", " ").strip().title()
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

        # ── Category: best-effort from the page <h1> (flat URLs carry none) ─
        h1 = soup.find("h1")
        category = clean_text(h1.get_text()) if h1 else None

        # ── Parse offer table ──────────────────────────────────────────────
        rows = self._find_offer_rows(soup)
        candidates: list[ScrapedOffer] = []

        if rows:
            for merchant, offer_text, eligibility in rows:
                if not merchant or len(merchant) < 3:
                    continue
                discount = extract_discount(offer_text) or extract_discount(eligibility) or None

                # Each row carries its own "Valid till …" in the eligibility
                # cell — prefer that over the page-level date.
                row_dates  = extract_dates(eligibility) if eligibility else {}
                row_from   = row_dates.get("valid_from") or valid_from
                row_to     = row_dates.get("valid_to")   or valid_to

                raw_parts = [merchant, offer_text]
                if eligibility: raw_parts.append(f"Eligibility: {eligibility}")
                if category:    raw_parts.append(f"Category: {category}")
                if row_to:      raw_parts.append(f"Valid to: {row_to.isoformat()}")
                raw_text = " | ".join(raw_parts)

                score = 0.55
                if discount:    score += 0.15
                if row_to:      score += 0.15
                if row_from:    score += 0.05
                if eligibility: score += 0.10

                ch = generate_candidate_hash(
                    source_url, merchant, discount,
                    row_to.isoformat() if row_to else None,
                    raw_text,
                )
                candidates.append(ScrapedOffer(
                    title=merchant,
                    description=offer_text[:500] if offer_text else None,
                    raw_text=truncate(raw_text, 2000),
                    source_url=source_url,
                    detected_merchant=merchant,
                    detected_discount=discount,
                    detected_valid_from=row_from,
                    detected_valid_to=row_to,
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
