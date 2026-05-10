"""
Seylan Bank promotions scraper.

Target: https://www.seylan.lk/promotions/cards

Server-rendered HTML. All 185 offers (~31 pages) are listed on the main
promotions page with 6 cards per page, paginated via ?page=N.

Offer card structure (confirmed 2026-05-09):
  <div class="card">
    <a href="https://calendar.google.com/...&dates=YYYYMMDD/YYYYMMDD&text=TITLE...">
      <img class="card-img-top" src="...">
    </a>
    <div class="card-body">
      <h5 class="card-title">MERCHANT / OFFER NAME</h5>
      <p class="card-text">Brief discount description...</p>
      <a href="https://www.seylan.lk/[offer-slug]">READ MORE</a>
    </div>
  </div>

Key insight: The Google Calendar link contains `dates=YYYYMMDD/YYYYMMDD`
which gives BOTH valid_from and valid_to with no extra HTTP requests.

Strategy:
  1. Fetch page 1 to discover the total number of pages.
  2. Paginate through all pages (?page=N).
  3. For each card, extract title, description/discount, dates from the
     Google Calendar link, and the individual offer URL.
  4. No individual offer pages need to be fetched — listing has everything.

Category URLs also available (/promotions/cards/dining etc.) but not
scraped here since the main page covers all offers across all categories.
"""
import re
import time
from datetime import date

from bs4 import BeautifulSoup, Tag

from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_BASE_URL  = "https://www.seylan.lk"
_LIST_URL  = f"{_BASE_URL}/promotions/cards"

# Google Calendar date param: &dates=YYYYMMDD/YYYYMMDD
_GCAL_DATES_RE = re.compile(r"[?&]dates=(\d{8})/(\d{8})")


class SeylanScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """Paginate through all offer listing pages."""
        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        # Page 1 — discover total page count
        first_html = self._safe_fetch(_LIST_URL)
        if not first_html:
            logger.error("  Seylan: failed to fetch page 1")
            return []

        total_pages = self._parse_total_pages(first_html)
        logger.info("  Seylan: %d page(s) to scrape", total_pages)

        for page_num in range(1, total_pages + 1):
            url = _LIST_URL if page_num == 1 else f"{_LIST_URL}?page={page_num}"
            html = first_html if page_num == 1 else self._safe_fetch(url)
            if not html:
                logger.warning("  Seylan: skipping page %d (fetch failed)", page_num)
                continue

            page_offers = self.parse(html)
            new = 0
            for offer in page_offers:
                if offer.candidate_hash not in seen_hashes:
                    seen_hashes.add(offer.candidate_hash)
                    candidates.append(offer)
                    new += 1

            logger.debug("  Seylan: page %d/%d → %d new candidate(s)", page_num, total_pages, new)
            if page_num < total_pages:
                time.sleep(0.4)   # polite rate limit

        logger.info("  Seylan: %d unique candidate(s) total", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")

        cards = soup.select("div.card")
        if not cards:
            logger.info("  Seylan: no div.card elements found — using generic parser")
            return self._generic_parse(html)

        results: list[ScrapedOffer] = []
        seen: set[str] = set()

        for card in cards:
            offer = self._card_to_offer(card)
            if offer and offer.candidate_hash not in seen:
                seen.add(offer.candidate_hash)
                results.append(offer)

        return results

    # ── Per-card extraction ───────────────────────────────────────────────

    def _card_to_offer(self, card: Tag) -> ScrapedOffer | None:
        body = card.find(class_="card-body")
        if not body:
            body = card   # some pages may not have .card-body wrapper

        # ── Title ─────────────────────────────────────────────────────────
        title_tag = body.find("h5") or body.find("h4") or body.find("h3")
        title = clean_text(title_tag.get_text()) if title_tag else None

        # Some Seylan cards carry Vue.js/Mustache template expressions in the
        # raw HTML (e.g. "{{slug}}">Victoria Golf Resort") because the site
        # renders part of its content client-side. Strip these artifacts before
        # saving so only the actual offer name is stored.
        if title:
            title = _strip_template_artifacts(title)

        if not title or len(title) < 3:
            return None

        # ── Description / discount ────────────────────────────────────────
        desc_tag = body.find(class_="card-text") or body.find("p")
        description = clean_text(desc_tag.get_text()) if desc_tag else None
        discount = extract_discount(description or title) or None

        # ── Dates from Google Calendar link ───────────────────────────────
        # Seylan embeds a Google Calendar event link with &dates=YYYYMMDD/YYYYMMDD
        valid_from: date | None = None
        valid_to:   date | None = None

        gcal_link = card.find("a", href=re.compile(r"calendar\.google\.com"))
        if gcal_link:
            m = _GCAL_DATES_RE.search(gcal_link.get("href", ""))
            if m:
                valid_from = _parse_gcal_date(m.group(1))
                valid_to   = _parse_gcal_date(m.group(2))

        # ── Source URL (individual offer page) ────────────────────────────
        # "READ MORE" link goes to https://www.seylan.lk/[offer-slug]
        read_more = body.find("a", string=re.compile(r"read\s*more", re.IGNORECASE))
        source_url = _LIST_URL
        if read_more:
            href = read_more.get("href", "")
            if href.startswith("http"):
                source_url = href
            elif href.startswith("/"):
                source_url = f"{_BASE_URL}{href}"

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts = [title]
        if description:  raw_parts.append(description)
        if valid_to:     raw_parts.append(f"Valid to: {valid_to.isoformat()}")
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
            detected_merchant=title,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=ch,
        )

    # ── Helpers ───────────────────────────────────────────────────────────

    def _safe_fetch(self, url: str) -> str:
        try:
            return self.fetch_html(url)
        except Exception as exc:
            logger.warning("  Seylan: fetch failed for %s: %s", url, exc)
            return ""

    @staticmethod
    def _parse_total_pages(html: str) -> int:
        """
        Detect total pages from pagination HTML.
        Looks for the highest page number link, e.g. "?page=31".
        Falls back to 1 if not found.
        """
        soup = BeautifulSoup(html, "lxml")
        max_page = 1

        # Strategy 1: look for ?page=N links
        for a in soup.find_all("a", href=True):
            m = re.search(r"[?&]page=(\d+)", a["href"])
            if m:
                max_page = max(max_page, int(m.group(1)))

        # Strategy 2: look for "X results" text to estimate
        if max_page == 1:
            text = soup.get_text()
            m = re.search(r"of\s+(\d+)\s+results?", text, re.IGNORECASE)
            if m:
                total = int(m.group(1))
                max_page = max(1, -(-total // 6))  # ceil(total/6)

        logger.debug("  Seylan: detected %d total page(s)", max_page)
        return max_page


# ── Module helpers ────────────────────────────────────────────────────────────

def _parse_gcal_date(yyyymmdd: str) -> date | None:
    """Parse Google Calendar's compact date format YYYYMMDD into a date object."""
    try:
        return date(int(yyyymmdd[:4]), int(yyyymmdd[4:6]), int(yyyymmdd[6:8]))
    except Exception:
        return None


# Matches Mustache/Handlebars {{...}} and Django/Jinja2 {%...%} expressions.
# These appear in Seylan's raw HTML for cards that are rendered client-side
# by Vue.js. Example: "{{slug}}">Victoria Golf Resort" → "Victoria Golf Resort"
_TEMPLATE_EXPR_RE = re.compile(r"\{[\{%][^}]*[\}%]\}")

# Strips leading attribute artifacts left after template removal: ">  or just >
_ATTR_ARTIFACT_RE = re.compile(r'^[\s"\'>\|]+')


def _strip_template_artifacts(text: str) -> str:
    """
    Remove Vue/Mustache/Jinja2 template expressions and any trailing HTML
    attribute fragments from a scraped text string.

    '{{slug}}">Victoria Golf Resort'  →  'Victoria Golf Resort'
    '{%  if slug  %}>Hotel Name'       →  'Hotel Name'
    """
    # Remove all template expressions
    text = _TEMPLATE_EXPR_RE.sub("", text)
    # Strip leading characters that look like attribute artifacts (", >, |, spaces)
    text = _ATTR_ARTIFACT_RE.sub("", text)
    return clean_text(text)
