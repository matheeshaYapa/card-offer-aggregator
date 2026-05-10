"""
Bank of Ceylon (BOC) promotions scraper.

Target: https://www.boc.lk/personal-banking/card-offers

The page is server-rendered HTML. All offers are listed across category
carousels (Travel & Leisure, Supermarkets, Dining, etc.). Every carousel
item is an <a> tag fully in the initial HTML — no lazy loading.

Listing card structure:
  <a href="/personal-banking/card-offers/[category]/[merchant]/product">
    <strong>20% OFF*</strong>        ← discount badge
    <img src="...">
    <h4>Merchant Name</h4>
    <p>Location, Sri Lanka</p>
    <p>Reservations : phone</p>
    <p>20% off for BOC Credit & Debit Cardholders</p>
    <p>Expiration date : 30 Nov 2026</p>
    <p>Read More</p>
  </a>

Individual offer page structure (followed for richer data):
  <h2>Merchant Name</h2>
  <strong>20% OFF<span>*</span></strong>
  <p>20% off for BOC Credit & Debit Cardholders</p>
  <p>From 01st March to 30th November 2026</p>    ← both dates!
  <strong>Expiration date : <strong>30 Nov 2026</strong></strong>

Strategy:
  1. Fetch main listing page — collect every unique /…/product URL.
  2. Follow each individual offer page for reliable discount, description
     and date extraction (the listing card discount badge is outside the
     heading structure making it easy to miss).
  3. Rate-limit: 0.3 s between detail fetches.
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

_BASE_URL  = "https://www.boc.lk"
_LIST_URL  = f"{_BASE_URL}/personal-banking/card-offers"

_OFFER_PATH_RE = re.compile(
    r"/personal-banking/card-offers/[^/]+/[^/]+/product$"
)

# Paragraphs to skip when extracting the offer description
_SKIP_PARA_RE = re.compile(
    r"read\s*more|reservations?|tel:|phone|^\+?[\d\s\-/()]{7,}$|"
    r"expiration\s*date|valid\s*(from|till|until|to)",
    re.IGNORECASE,
)


class BOCScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """
        Collect all offer URLs from the listing page, then scrape each
        individual offer page for complete data.
        """
        # ── Step 1: collect all offer URLs from the listing ────────────────
        try:
            listing_html = self.fetch_html(_LIST_URL)
        except Exception as exc:
            logger.error("  BOC: failed to fetch listing page: %s", exc)
            return []

        offer_urls = self._collect_offer_urls(listing_html)
        logger.info("  BOC: found %d unique offer URL(s)", len(offer_urls))

        if not offer_urls:
            logger.info("  BOC: falling back to listing-only parse")
            return self.parse(listing_html)

        # ── Step 2: scrape each detail page ───────────────────────────────
        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for i, url in enumerate(offer_urls, 1):
            try:
                html = self.fetch_html(url)
                offer = self._parse_detail_page(html, url)
                if offer and offer.candidate_hash not in seen_hashes:
                    seen_hashes.add(offer.candidate_hash)
                    candidates.append(offer)
                logger.debug("  BOC: [%d/%d] %s → %s",
                             i, len(offer_urls),
                             url.rsplit("/", 2)[-2],
                             "OK" if offer else "skip")
            except Exception as exc:
                logger.warning("  BOC: failed to scrape %s: %s", url, exc)

            if i < len(offer_urls):
                time.sleep(0.3)

        logger.info("  BOC: extracted %d candidate(s)", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:
        """
        Fallback: extract from listing page only (no individual page fetches).
        Used when BaseScraper.run() calls parse() directly.
        """
        soup = BeautifulSoup(html, "lxml")
        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()
        seen_urls: set[str] = set()

        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            full = f"{_BASE_URL}{href}" if href.startswith("/") else href
            if not _OFFER_PATH_RE.search(full) or full in seen_urls:
                continue
            seen_urls.add(full)

            offer = self._extract_from_listing_card(a, full)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        logger.info("  BOC: listing-only parse → %d candidate(s)", len(candidates))
        return candidates

    # ── URL collection ────────────────────────────────────────────────────

    def _collect_offer_urls(self, html: str) -> list[str]:
        soup = BeautifulSoup(html, "lxml")
        seen: set[str] = set()
        urls: list[str] = []
        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            full = f"{_BASE_URL}{href}" if href.startswith("/") else href
            if _OFFER_PATH_RE.search(full) and full not in seen:
                seen.add(full)
                urls.append(full)
        return urls

    # ── Detail page parsing ───────────────────────────────────────────────

    def _parse_detail_page(self, html: str, source_url: str) -> ScrapedOffer | None:
        soup = BeautifulSoup(html, "lxml")

        # ── Fix 1: strip nav / header / footer so their <h2> don't pollute ─
        # BOC's sidebar has <h2>Online Banking</h2> which would otherwise be
        # picked up as the merchant name.
        for unwanted in soup(["nav", "header", "footer", "aside"]):
            unwanted.decompose()

        # Also remove any element whose text is a known nav label
        _NAV_LABELS = {"online banking", "personal banking", "sme banking",
                       "corporate banking", "home", "menu", "back"}
        for tag in soup.find_all(["h1", "h2", "h3"]):
            if clean_text(tag.get_text()).lower() in _NAV_LABELS:
                tag.decompose()

        # ── Merchant from <h2> in main content ────────────────────────────
        merchant: str | None = None
        for h2 in soup.find_all("h2"):
            text = clean_text(h2.get_text())
            if text and 3 < len(text) < 120:
                merchant = text
                break

        # fallback to <h3> or <h4>
        if not merchant:
            for tag in soup.find_all(["h3", "h4"]):
                text = clean_text(tag.get_text())
                if text and 3 < len(text) < 120:
                    merchant = text
                    break

        if not merchant:
            parts = source_url.rstrip("/").split("/")
            merchant = parts[-2].replace("-", " ").title() if len(parts) >= 2 else None

        if not merchant or len(merchant) < 3:
            return None

        title = merchant

        # ── Fix 2: discount — skip emails, be precise about "plan" ────────
        # "paymentplans@boc.lk" was matching because "plan" was in the regex.
        # Now: skip any text with "@", require "0%" or "installment/instalment"
        # for plan-type matches, fall back to "Special offer" when nothing found.
        discount: str | None = None
        for strong in soup.find_all(["strong", "b"]):
            text = clean_text(strong.get_text())
            if not text or len(text) > 80:
                continue
            if "@" in text:                              # skip email addresses
                continue
            if re.search(r"expiration|valid\s*(from|till|until|to)", text, re.IGNORECASE):
                continue
            if re.search(
                r"%|off\b|free\b|cashback|0%\s*instalment|0%\s*installment"
                r"|instalment\s*plan|installment\s*plan",
                text, re.IGNORECASE,
            ):
                discount = extract_discount(text) or text
                break

        # Fix 4: if no specific discount found, fall back to "Special offer"
        if not discount:
            discount = "Special offer"

        # ── Paragraphs: offer description and date range ──────────────────
        description: str | None = None
        date_text = ""

        for p in soup.find_all("p"):
            text = clean_text(p.get_text())
            if not text or len(text) < 5 or "@" in text:
                continue
            if _SKIP_PARA_RE.search(text):
                continue
            if re.search(r"\bfrom\b|\btill\b|\buntil\b|\b2025\b|\b2026\b|\b2027\b",
                         text, re.IGNORECASE):
                if not date_text:
                    date_text = text
                continue
            if not description:
                description = text

        # ── Fix 3: BOC expiry format "Expiration date : 30 Nov 2026" ──────
        # The standard date_extractor doesn't handle this format.
        # Extract the date string after the colon and parse it with dateutil.
        valid_from = None
        valid_to   = None

        # First try standard extractor on the date-range paragraph (From…to…)
        if date_text:
            dates     = extract_dates(date_text)
            valid_from = dates.get("valid_from")
            valid_to   = dates.get("valid_to")

        # Then try BOC's "Expiration date : DD Mon YYYY" format
        if not valid_to:
            expiry_text = _extract_boc_expiry(soup)
            if expiry_text:
                valid_to = _parse_boc_date(expiry_text)

        # Also try description text if still no dates
        if not valid_from and not valid_to and description:
            dates2     = extract_dates(description)
            valid_from = valid_from or dates2.get("valid_from")
            valid_to   = valid_to   or dates2.get("valid_to")

        # ── Category from URL ─────────────────────────────────────────────
        parts = source_url.replace(_BASE_URL, "").split("/")
        # ['', 'personal-banking', 'card-offers', 'category', 'merchant', 'product']
        category = parts[3].replace("-", " ").title() if len(parts) >= 5 else None

        # ── Build raw_text ────────────────────────────────────────────────
        raw_parts = [title]
        if discount:    raw_parts.append(discount)
        if description: raw_parts.append(description)
        if date_text:   raw_parts.append(date_text)
        if category:    raw_parts.append(f"Category: {category}")
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

    # ── Listing card extraction (fallback) ────────────────────────────────

    def _extract_from_listing_card(self, link: Tag, source_url: str) -> ScrapedOffer | None:
        """Extract from listing <a> card when individual page is not fetched."""
        all_text = clean_text(link.get_text(separator=" "))

        # Merchant from <h4> (most reliable on listing)
        h = link.find(["h4", "h3", "h2"])
        merchant = clean_text(h.get_text()) if h else None
        if not merchant:
            parts = source_url.rstrip("/").split("/")
            merchant = parts[-2].replace("-", " ").title() if len(parts) >= 2 else None
        if not merchant or len(merchant) < 3:
            return None

        # Discount: look for <strong>/<b> with % or "OFF"
        discount: str | None = None
        for strong in link.find_all(["strong", "b"]):
            text = clean_text(strong.get_text())
            if re.search(r"%|off\b", text, re.IGNORECASE) and len(text) < 60:
                discount = extract_discount(text) or text
                break
        # Fallback: first text token matching discount pattern
        if not discount:
            discount = extract_discount(all_text) or None

        # Dates and description from paragraphs
        date_text = ""
        description: str | None = None
        for p in link.find_all("p"):
            text = clean_text(p.get_text())
            if not text or re.search(r"read\s*more|reservations?|^\+?[\d\s\-/()]{7,}$", text, re.IGNORECASE):
                continue
            if re.search(r"expiration|valid\s*(from|till)|2026|2027", text, re.IGNORECASE):
                date_text = text
            elif not description and len(text) > 5:
                description = text

        dates     = extract_dates(date_text or all_text)
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        parts = source_url.replace(_BASE_URL, "").split("/")
        category = parts[3].replace("-", " ").title() if len(parts) >= 5 else None

        raw_parts = [merchant]
        if discount:    raw_parts.append(discount)
        if description: raw_parts.append(description)
        if category:    raw_parts.append(f"Category: {category}")
        raw_text = " | ".join(raw_parts)

        score = 0.55
        if discount:    score += 0.20
        if valid_to:    score += 0.15
        if valid_from:  score += 0.05

        ch = generate_candidate_hash(
            source_url, merchant, discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )
        return ScrapedOffer(
            title=merchant,
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


# ── Module-level helpers ──────────────────────────────────────────────────────

# BOC expiry format: "Expiration date : 30 Nov 2026"
_BOC_EXPIRY_RE = re.compile(
    r"expiration\s*date\s*[:\-]?\s*"
    r"(\d{1,2}(?:st|nd|rd|th)?\s+"
    r"(?:January|February|March|April|May|June|July|August|September|"
    r"October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
    r"\s+\d{4})",
    re.IGNORECASE,
)


def _extract_boc_expiry(soup: BeautifulSoup) -> str | None:
    page_text = soup.get_text(separator=" ")
    m = _BOC_EXPIRY_RE.search(page_text)
    return m.group(1).strip() if m else None


def _parse_boc_date(date_str: str):
    from datetime import date as _date
    try:
        from dateutil import parser as _dp
        return _dp.parse(date_str, dayfirst=True).date()
    except Exception:
        pass
    _MONTHS = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    mo = re.match(
        r"(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})",
        date_str.strip(),
    )
    if mo:
        try:
            day = int(mo.group(1))
            mon = _MONTHS.get(mo.group(2)[:3].lower())
            yr  = int(mo.group(3))
            if mon:
                return _date(yr, mon, day)
        except Exception:
            pass
    return None
