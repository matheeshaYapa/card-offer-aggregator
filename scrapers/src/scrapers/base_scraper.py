"""
Base scraper class for CardPromo LK.

Each bank scraper extends BaseScraper and implements parse().
fetch_html() uses requests by default; override for JS-heavy pages.
"""
from abc import ABC, abstractmethod

import requests
from bs4 import BeautifulSoup, Tag

from src.extractors.date_extractor import extract_dates
from src.extractors.discount_extractor import extract_discount
from src.extractors.merchant_extractor import extract_merchant_from_title
from src.models.scraped_offer import ScrapedOffer
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, is_meaningful, truncate

logger = get_logger(__name__)

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class BaseScraper(ABC):
    """Abstract base for all bank scrapers."""

    def __init__(self, source: dict) -> None:
        self.source = source
        self.source_url: str = source.get("source_url", "")
        self.bank_slug: str = source.get("bank_slug", "")

    # ── Network ──────────────────────────────────────────────────────────

    def fetch_html(self, url: str | None = None) -> str:
        """Fetch page HTML. Override for JavaScript-heavy pages."""
        target = url or self.source_url
        logger.info("  Fetching %s", target)
        resp = requests.get(target, headers=_DEFAULT_HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text

    # ── Parsing ──────────────────────────────────────────────────────────

    @abstractmethod
    def parse(self, html: str) -> list[ScrapedOffer]:
        """Parse page HTML and return candidate offers."""

    # ── Entry point ──────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        html = self.fetch_html()
        return self.parse(html)

    # ── Helper: build a candidate from a BS4 block ───────────────────────

    def _extract_from_block(
        self,
        block: Tag,
        source_url: str | None = None,
    ) -> ScrapedOffer | None:
        """
        Generic extraction from a BeautifulSoup tag block.
        Tries specific sub-elements then falls back to full block text.
        """
        url = source_url or self.source_url

        # ── Raw text ─────────────────────────────────────────────────────
        raw_text = clean_text(block.get_text(separator=" "))
        if not is_meaningful(raw_text, min_words=6):
            return None

        # ── Title: prefer heading > link > first line ─────────────────────
        title_tag = block.find(["h1", "h2", "h3", "h4", "h5"])
        if title_tag:
            title = clean_text(title_tag.get_text())
        else:
            link_tag = block.find("a")
            if link_tag and link_tag.get_text(strip=True):
                title = clean_text(link_tag.get_text())
            else:
                first_line = raw_text.split(".")[0].split(",")[0]
                title = first_line[:120] if len(first_line) > 10 else None

        # Skip trivially short/useless titles
        if title and len(title) < 8:
            title = None

        # ── Extractors ────────────────────────────────────────────────────
        detected_discount = extract_discount(raw_text)
        dates = extract_dates(raw_text)
        detected_merchant = extract_merchant_from_title(title)

        # ── Confidence score ──────────────────────────────────────────────
        score = 0.0
        if title:
            score += 0.35
        if detected_discount:
            score += 0.30
        if dates.get("valid_to"):
            score += 0.20
        if dates.get("valid_from"):
            score += 0.10
        if detected_merchant:
            score += 0.05

        if score < 0.15:
            return None  # Not enough signal

        # ── Candidate hash ────────────────────────────────────────────────
        candidate_hash = generate_candidate_hash(
            url,
            title,
            detected_discount,
            dates["valid_to"].isoformat() if dates.get("valid_to") else None,
            raw_text,
        )

        # ── Description: block text minus heading ─────────────────────────
        if title_tag:
            title_tag.decompose()
        desc_text = truncate(clean_text(block.get_text(separator=" ")), 500)

        return ScrapedOffer(
            title=title,
            description=desc_text or None,
            raw_text=truncate(raw_text, 2000),
            source_url=url,
            detected_merchant=detected_merchant,
            detected_discount=detected_discount,
            detected_valid_from=dates.get("valid_from"),
            detected_valid_to=dates.get("valid_to"),
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=candidate_hash,
        )

    # ── Fallback: scan entire page for promo-like blocks ─────────────────

    def _generic_parse(self, html: str) -> list[ScrapedOffer]:
        """
        Last-resort parser: scans the whole page for blocks that look
        like promotions (have a heading + enough text).
        """
        soup = BeautifulSoup(html, "lxml")

        # Remove navigation, footer, script, style noise
        for tag in soup(["nav", "footer", "header", "script", "style", "aside"]):
            tag.decompose()

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        # Look for any div/section/article with a heading child
        for block in soup.find_all(["div", "section", "article", "li"]):
            if not block.find(["h2", "h3", "h4", "h5"]):
                continue
            text_len = len(block.get_text(strip=True))
            if text_len < 40 or text_len > 3000:
                continue

            offer = self._extract_from_block(block)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        logger.info("  Generic parser found %d candidates", len(candidates))
        return candidates


class GenericScraper(BaseScraper):
    """Falls back to the generic page-wide heuristic parser."""

    def parse(self, html: str) -> list[ScrapedOffer]:
        return self._generic_parse(html)
