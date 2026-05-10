"""
NDB Bank promotions scraper.

Target: https://www.ndbbank.com/cards/card-offers

Server-rendered HTML. All ~80 offers appear on a single listing page
with no pagination. Each card is an anchor linking to a detail page:

  <a href="/cards/card-offers/offer-details/[ID]">
    <img ... alt="[offer title]">
    <img ... alt="[merchant logo]">
    <h5>[Offer title — often includes discount %]</h5>
    <p>[Merchant name]</p>
    <p>[Card eligibility e.g. "Credit Cards"]</p>
    <p>[Contact number — optional]</p>
    <p>[Validity date e.g. "Until 31st May 2026"]</p>
  </a>

Individual detail pages have:
  <h1> title, div.offer-details (dates + card type),
  div.merchant-details (h3 merchant), div.special-conditions (terms ul)

Strategy:
  All data needed is available on the listing page itself — no detail
  page visits required. Parse each <a href="/cards/card-offers/offer-details/...">
  card to extract title, merchant, card type, and validity dates.
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

_BASE_URL = "https://www.ndbbank.com"
_LIST_URL = f"{_BASE_URL}/cards/card-offers"

# Offer detail URL pattern
_DETAIL_HREF_RE = re.compile(r"/cards/card-offers/offer-details/\d+")

# Paragraphs that look like phone numbers or junk — skip these
_PHONE_RE = re.compile(r"^\+?[\d\s\-()]{7,}$")


class NDBScraper(BaseScraper):

    def parse(self, html: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")

        # Find every offer card link
        offer_cards: list[Tag] = [
            a for a in soup.find_all("a", href=True)
            if _DETAIL_HREF_RE.search(a["href"])
        ]

        if not offer_cards:
            logger.info("  NDB: no offer-detail links found — using generic parser")
            return self._generic_parse(html)

        logger.info("  NDB: found %d offer card(s)", len(offer_cards))

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()
        seen_urls: set[str] = set()

        for card in offer_cards:
            href = card["href"]
            source_url = f"{_BASE_URL}{href}" if href.startswith("/") else href
            if source_url in seen_urls:
                continue
            seen_urls.add(source_url)

            offer = self._card_to_offer(card, source_url)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        logger.info("  NDB: extracted %d candidate(s)", len(candidates))
        return candidates

    # ── Per-card extraction ───────────────────────────────────────────────

    def _card_to_offer(self, card: Tag, source_url: str) -> ScrapedOffer | None:
        # ── Title from <h5> ───────────────────────────────────────────────
        h = card.find(["h5", "h4", "h3"])
        title = clean_text(h.get_text()) if h else None

        # Fallback: alt text on main (first) image
        if not title:
            img = card.find("img")
            if img and img.get("alt"):
                title = clean_text(img["alt"])

        if not title or len(title) < 5:
            return None

        # ── Paragraphs: merchant, card type, dates ────────────────────────
        paras = [clean_text(p.get_text()) for p in card.find_all("p") if p.get_text(strip=True)]
        # Filter out phone numbers and very short strings
        paras = [p for p in paras if p and len(p) > 2 and not _PHONE_RE.match(p)]

        merchant   = paras[0] if paras else None
        card_type  = paras[1] if len(paras) > 1 else None

        # Last non-empty paragraph most likely contains dates
        date_text = ""
        for p in reversed(paras):
            if re.search(r"\d{4}|till|until|valid|every|from", p, re.IGNORECASE):
                date_text = p
                break

        # ── Dates ─────────────────────────────────────────────────────────
        combined = f"{date_text} {title}".strip()
        dates     = extract_dates(combined)
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        # ── Discount from title ───────────────────────────────────────────
        discount = extract_discount(title) or None

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts = [title]
        if merchant:   raw_parts.append(f"Merchant: {merchant}")
        if card_type:  raw_parts.append(f"Card: {card_type}")
        if date_text:  raw_parts.append(date_text)
        raw_text = " | ".join(raw_parts)

        # ── Confidence ────────────────────────────────────────────────────
        score = 0.60
        if discount:    score += 0.15
        if valid_to:    score += 0.15
        if valid_from:  score += 0.05
        if merchant:    score += 0.05

        ch = generate_candidate_hash(
            source_url, title, discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )

        return ScrapedOffer(
            title=title,
            description=date_text or None,
            raw_text=truncate(raw_text, 2000),
            source_url=source_url,
            detected_merchant=merchant,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=ch,
        )
