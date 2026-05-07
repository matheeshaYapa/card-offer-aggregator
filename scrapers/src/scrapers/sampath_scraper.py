"""
Sampath Bank promotions scraper.

Target: https://www.sampath.lk/sampath-cards/credit-card-offer

Uses bank-specific selectors with a generic fallback.
"""
from bs4 import BeautifulSoup, Tag

from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.logger import get_logger

logger = get_logger(__name__)

_CANDIDATE_SELECTORS = [
    ".promotions-wrapper .promotion-item",
    ".promo-grid .promo-item",
    ".promotion-list .item",
    ".offer-list .offer",
    ".promotions .col-md-4",
    ".promotions .col-sm-6",
    "article.promo",
    ".promotion-card",
]


class SampathScraper(BaseScraper):

    def parse(self, html: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")

        blocks: list[Tag] = []
        for selector in _CANDIDATE_SELECTORS:
            found = soup.select(selector)
            if found:
                logger.debug(
                    "  Sampath: matched selector '%s' → %d blocks", selector, len(found)
                )
                blocks = found
                break

        if not blocks:
            logger.info("  Sampath: no specific selector matched, using generic parser")
            return self._generic_parse(html)

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for block in blocks:
            offer = self._extract_from_block(block)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        logger.info("  Sampath: extracted %d candidates", len(candidates))
        return candidates
