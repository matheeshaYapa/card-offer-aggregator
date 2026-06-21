"""
Amana Bank promotions scraper.

Target: https://www.amanabank.lk/personal/services/visa-debit-card/offers/

Server-rendered HTML. Amana Bank only issues Visa Debit Cards — no credit cards.

As of 2026-06 the offers page was rebuilt. Every offer is a single
`div.offer-item-wrapper`, and — crucially — carries a calendar "add to
calendar" button whose `data-ics` attribute is a JSON blob with fully
structured data:

  <div class="item-wrapper-box offer-item-wrapper" data-districts="nuwaraeliya">
    <img alt="Araliya Green City" ...>
    <a class="calendar_button"
       data-ics='{"start":"2026-07-31","end":"2026-07-31",
                  "summary":"Araliya Green City",
                  "description":"30% Off on the standard Bill for Amana cardholders"}'>
    <div class="pop"> … <h3 class="pop_up_title">Araliya Green City</h3> …
        <div class="pop-row-2"><p>30% Off on the standard Bill …</p></div> …
    </div>
  </div>

Strategy:
  1. Fetch the single offers page (all ~48 offers are server-rendered there).
  2. For each `div.offer-item-wrapper`, read the `data-ics` JSON for
     merchant (summary), description, and start/end dates — the most reliable
     signal available. Fall back to the visible <h3>/<p> if ICS is missing.
  3. Derive the discount from the description text.
"""
import json
import re
from datetime import date

from bs4 import BeautifulSoup, Tag

from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_BASE_URL = "https://www.amanabank.lk"
_MAIN_URL = f"{_BASE_URL}/personal/services/visa-debit-card/offers/"


class AmanaScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """Scrape the single offers page (all offers are server-rendered)."""
        url = self.source_url or _MAIN_URL
        try:
            html = self.fetch_html(url)
        except Exception as exc:
            logger.error("  Amana: failed to fetch %s: %s", url, exc)
            return []

        candidates = self._parse_page(html, url)
        logger.info("  Amana: %d unique candidate(s) total", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:
        """Fallback — called by BaseScraper.run() if needed."""
        return self._parse_page(html, self.source_url or _MAIN_URL)

    # ── Page parsing ──────────────────────────────────────────────────────

    def _parse_page(self, html: str, page_url: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")
        wrappers = soup.find_all("div", class_="offer-item-wrapper")

        if not wrappers:
            logger.debug("  Amana: no div.offer-item-wrapper on %s", page_url)
            return []

        results: list[ScrapedOffer] = []
        seen: set[str] = set()

        for wrapper in wrappers:
            offer = self._extract_offer(wrapper, page_url)
            if offer and offer.candidate_hash not in seen:
                seen.add(offer.candidate_hash)
                results.append(offer)

        return results

    # ── Per-offer extraction ──────────────────────────────────────────────

    def _extract_offer(self, wrapper: Tag, source_url: str) -> ScrapedOffer | None:
        ics = self._read_ics(wrapper)

        # ── Merchant ──────────────────────────────────────────────────────
        merchant = (ics.get("summary") or "").strip() or None
        if not merchant:
            h3 = wrapper.find(["h3", "h4", "h2"])
            merchant = clean_text(h3.get_text()) if h3 else None
        if not merchant:
            img = wrapper.find("img", alt=True)
            merchant = clean_text(img["alt"]) if img and img.get("alt") else None
        if not merchant or len(merchant) < 2:
            return None
        title = merchant

        # ── Description (offer text) ──────────────────────────────────────
        description = (ics.get("description") or "").strip() or None
        if not description:
            row2 = wrapper.find("div", class_="pop-row-2")
            if row2:
                for p in row2.find_all("p"):
                    txt = clean_text(p.get_text())
                    if txt and len(txt) >= 4:
                        description = txt
                        break

        # ── Dates from the ICS start/end (ISO yyyy-mm-dd) ─────────────────
        valid_from = _parse_iso(ics.get("start"))
        valid_to   = _parse_iso(ics.get("end"))
        # The site frequently duplicates the end date into "start" when only an
        # expiry is known — treat an equal pair as "end only".
        if valid_from and valid_to and valid_from == valid_to:
            valid_from = None

        # ── Discount ──────────────────────────────────────────────────────
        discount = extract_discount(description or title) or None

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts = [title]
        if description: raw_parts.append(description)
        if valid_to:    raw_parts.append(f"Valid to: {valid_to.isoformat()}")
        districts = wrapper.get("data-districts")
        if districts:   raw_parts.append(f"Districts: {districts}")
        raw_parts.append("Card: Visa Debit")
        raw_text = " | ".join(raw_parts)

        # ── Confidence ────────────────────────────────────────────────────
        score = 0.60
        if discount:    score += 0.15
        if valid_to:    score += 0.15
        if valid_from:  score += 0.05
        if description: score += 0.05

        ch = generate_candidate_hash(
            source_url, title, discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )

        return ScrapedOffer(
            title=title,
            description=description,
            raw_text=truncate(raw_text, 2000),
            source_url=source_url,
            detected_merchant=merchant,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=ch,
        )

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _read_ics(wrapper: Tag) -> dict:
        """Parse the calendar button's data-ics JSON (best-effort)."""
        btn = wrapper.find("a", class_="calendar_button")
        raw = btn.get("data-ics") if btn else None
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            # Some entries contain stray control chars — strip and retry.
            try:
                return json.loads(re.sub(r"[\x00-\x1f]", " ", raw))
            except Exception:
                return {}


def _parse_iso(value: str | None) -> date | None:
    """Parse an ISO yyyy-mm-dd date, returning None on failure."""
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip()[:10])
    except (ValueError, AttributeError):
        return None
