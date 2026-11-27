import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from src.extractors.date_extractor import extract_schedule
from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.text_cleaner import clean_text, truncate

ONLINE_URL = "https://www.dfcc.lk/en/dfcc-card-offers/online-promotion"
HOTELS_URL = "https://www.dfcc.lk/dfcc-cards/hotels-promotions"
_DETAIL_PATH = re.compile(r"^/cards/cards-promotions/[a-z0-9-]+/?$")
_CARD_EVIDENCE = re.compile(
    r"\boffer valid on DFCC (credit|debit) cards\b",
    re.IGNORECASE,
)


class DFCCScraper(BaseScraper):
    """Read DFCC's server-rendered online and hotel promotion feeds."""

    def run(self) -> list[ScrapedOffer]:
        offers: dict[str, ScrapedOffer] = {}
        for url, category in [(self.source_url or ONLINE_URL, "online"), (HOTELS_URL, "travel")]:
            try:
                parsed = self._parse_category(self.fetch_html(url), url, category)
                if not parsed:
                    self.flag_issue(f"DFCC {category} page contained no offer cards")
                offers.update((offer.candidate_hash, offer) for offer in parsed)
            except Exception as exc:
                self.flag_issue(f"DFCC {category} page failed: {exc}")
        return list(offers.values())

    def parse(self, html: str) -> list[ScrapedOffer]:
        return self._parse_category(html, self.source_url or ONLINE_URL, "online")

    def _parse_category(self, html: str, listing_url: str, category: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")
        offers = []
        for card in soup.select(".cardOfferItem"):
            summary = card.select_one(".cardOfferText")
            detail = card.select_one(".bIRM a[href]")
            if not summary or not detail or not _DETAIL_PATH.fullmatch(detail["href"]):
                continue
            description = clean_text(summary.get_text(" ", strip=True))
            title = re.split(r"\.\s+Offer valid on\b", description, maxsplit=1, flags=re.IGNORECASE)[0]
            if not title:
                continue

            source_url = urljoin(listing_url, detail["href"])
            validity = card.select_one(".cardOfferValid")
            date_text = clean_text(validity.get_text(" ", strip=True)) if validity else ""
            dates = extract_schedule(date_text)
            valid_from, valid_to = dates["valid_from"], dates["valid_to"]
            discount = extract_discount(title)
            type_match = _CARD_EVIDENCE.search(description)
            card_type = type_match[1].lower() if type_match else None

            raw_text = " | ".join(filter(None, (
                description, f"Category: {category}", date_text, f"Card: {card_type}" if card_type else None,
            )))
            score = 0.55 + 0.15 * bool(discount) + 0.15 * bool(valid_to) + 0.10 * bool(card_type)
            offers.append(ScrapedOffer(
                title=truncate(title, 180),
                description=truncate(description, 500),
                raw_text=truncate(raw_text, 2000),
                source_url=source_url,
                detected_discount=discount,
                detected_valid_from=valid_from,
                detected_valid_to=valid_to,
                confidence_score=round(score, 2),
                candidate_hash=generate_candidate_hash(
                    source_url, title, discount, valid_to.isoformat() if valid_to else None,
                ),
            ))
        return offers
