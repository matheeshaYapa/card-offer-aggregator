"""
HNB (Hatton National Bank) promotions scraper.

Target: https://www.hnb.lk/personal/promotions/card-promotion/card-offers

Uses bank-specific selectors with a generic fallback.
Selectors are intentionally broad to be resilient to minor HTML changes.
"""
from bs4 import BeautifulSoup, Tag

from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.logger import get_logger

logger = get_logger(__name__)

# CSS selectors tried in priority order (most specific → most generic)
_CANDIDATE_SELECTORS = [
    ".promotions-listing .promo-item",
    ".promotions-listing .item",
    ".promotion-card",
    ".promo-card",
    ".offer-card",
    ".card-offer",
    ".col-md-4.promo",
    ".col-sm-6.promotion",
    "article.promotion",
    ".promotions .row > div",
    ".promotions-grid > div",
]


class HNBScraper(BaseScraper):

    def parse(self, html: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")

        # Try specific selectors first
        blocks: list[Tag] = []
        for selector in _CANDIDATE_SELECTORS:
            found = soup.select(selector)
            if found:
                logger.debug("  HNB: matched selector '%s' → %d blocks", selector, len(found))
                blocks = found
                break

        if not blocks:
            logger.info("  HNB: no specific selector matched, using generic parser")
            return self._generic_parse(html)

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for block in blocks:
            offer = self._extract_from_block(block)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        logger.info("  HNB: extracted %d candidates", len(candidates))
        return candidates
