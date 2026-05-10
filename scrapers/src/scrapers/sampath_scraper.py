"""
Sampath Bank promotions scraper — JSON API via Playwright.

Discovery notes (2026-05-07 / 2026-05-08):
  • The site is an Angular SPA behind Cloudflare domain-wide protection.
  • Plain requests and cloudscraper are both blocked (HTTP 503).

  Strategy:
    1. Playwright loads the main page → solves Cloudflare challenge.
    2. For each known category, call the JSON API via page.evaluate() which
       runs inside the browser context and inherits the CF clearance cookies.
    3. Parse the JSON response into ScrapedOffer objects.

  API endpoint (confirmed):
    GET https://www.sampath.lk/api/card-promotions
        ?category=<slug>&page_number=<n>&size=<size>

  Confirmed category slugs (from DevTools network tab, 2026-05-08):
    hotels, super_markets, online, Electronics_and_Furniture,
    health_and_insurance, fashion, dining, travel_and_leisure,
    Premium_Offers, VISA_Offers, Mastercard_Offers, Other

  Confirmed response shape:
    {
      "data": [
        {
          "id": 2395,
          "company_name": "Villa Victorini",   ← merchant / title
          "description": "<span>…</span>",      ← HTML offer text, strip tags
          "discount": null,                      ← often null, extract from description
          "promotion_period": "",               ← date range string, often empty
          "category": "hotels",
          "city": "Digana",
          "image_url": "…",
          "eligible_card_categories": null
        }
      ],
      "page_number": 1,
      "size": 50,
      "total": 12
    }
"""
import re
import time
from datetime import date

from bs4 import BeautifulSoup

from src.extractors.date_extractor import extract_dates
from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_BASE_URL = "https://www.sampath.lk"
_PAGE_URL = f"{_BASE_URL}/sampath-cards/credit-card-offer"
_API_PATH = "/api/card-promotions"

# Exact category slugs accepted by the API.
# Confirmed from Chrome DevTools Network tab (2026-05-08).
# Case-sensitive — use exactly as listed.
_CATEGORIES = [
    "hotels",
    "super_markets",
    "online",
    "Electronics_and_Furniture",
    "health_and_insurance",
    "fashion",
    "dining",
    "travel_and_leisure",
    "Premium_Offers",
    "VISA_Offers",
    "Mastercard_Offers",
    "Other",
]

_PAGE_SIZE = 50


class SampathScraper(BaseScraper):
    """API-based scraper. Uses Playwright to satisfy Cloudflare, then calls JSON API."""

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        try:
            from playwright.sync_api import sync_playwright  # noqa: PLC0415
        except ImportError:
            logger.error(
                "  Sampath: Playwright not installed. "
                "Run: python -m playwright install --with-deps chromium"
            )
            return []

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/147.0.0.0 Safari/537.36"
                ),
                locale="en-GB",
                timezone_id="Asia/Colombo",
                viewport={"width": 1280, "height": 800},
            )
            context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            )
            page = context.new_page()

            # ── Step 1: load main page to obtain Cloudflare clearance ─────
            # Use "domcontentloaded" instead of "networkidle":
            # Sampath's Angular SPA fires background API calls indefinitely,
            # so "networkidle" is never reached and causes a timeout.
            # "domcontentloaded" finishes as soon as the HTML is parsed and
            # the CF cookie is set. We then sleep briefly to let Angular
            # bootstrap before making page.evaluate() API calls.
            logger.info("  Sampath: loading main page for Cloudflare clearance …")
            try:
                page.goto(_PAGE_URL, wait_until="domcontentloaded", timeout=30_000)
                # Give Angular time to initialise and register the CF cookies
                time.sleep(4)
                logger.info("  Sampath: main page loaded OK — CF challenge passed")
            except Exception as exc:
                logger.error("  Sampath: failed to load main page: %s", exc)
                browser.close()
                return []

            # ── Step 2: scrape each category via the JSON API ─────────────
            for category in _CATEGORIES:
                try:
                    cat_offers = self._fetch_category(page, category, seen_hashes)
                    candidates.extend(cat_offers)
                    logger.info(
                        "  Sampath: category=%-26s → %d candidate(s)",
                        category, len(cat_offers),
                    )
                except Exception as exc:
                    logger.warning("  Sampath: category=%s failed: %s", category, exc)

                time.sleep(0.5)   # polite rate limit

            browser.close()

        logger.info("  Sampath: %d unique candidate(s) total", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:  # pragma: no cover
        return []

    # ── Per-category pagination ───────────────────────────────────────────

    def _fetch_category(
        self,
        page,
        category: str,
        seen_hashes: set[str],
    ) -> list[ScrapedOffer]:
        offers: list[ScrapedOffer] = []
        page_num = 1

        while True:
            api_url = (
                f"{_API_PATH}"
                f"?category={category}"
                f"&page_number={page_num}"
                f"&size={_PAGE_SIZE}"
            )
            raw = self._api_call(page, api_url, referer=f"{_PAGE_URL}")
            if raw is None:
                break

            items = _extract_items(raw)
            if not items:
                break

            for item in items:
                offer = _item_to_offer(item, category)
                if offer and offer.candidate_hash not in seen_hashes:
                    seen_hashes.add(offer.candidate_hash)
                    offers.append(offer)

            # Stop when we've fetched everything
            total = _extract_total(raw)
            if total and page_num * _PAGE_SIZE >= total:
                break
            if len(items) < _PAGE_SIZE:
                break
            page_num += 1

        return offers

    def _api_call(self, page, api_url: str, referer: str):
        """Run a fetch() inside the Playwright browser context. Returns JSON or None."""
        try:
            raw = page.evaluate(
                f"""async () => {{
                    try {{
                        const res = await fetch('{api_url}', {{
                            headers: {{
                                'accept': 'application/json, text/plain, */*',
                                'referer': '{referer}',
                                'sec-fetch-dest': 'empty',
                                'sec-fetch-mode': 'cors',
                                'sec-fetch-site': 'same-origin',
                            }}
                        }});
                        if (!res.ok) return {{ __error: res.status }};
                        return await res.json();
                    }} catch (e) {{
                        return {{ __error: e.message }};
                    }}
                }}"""
            )
        except Exception as exc:
            logger.warning("  Sampath: page.evaluate failed for %s: %s", api_url, exc)
            return None

        if not raw:
            return None
        if isinstance(raw, dict) and "__error" in raw:
            logger.warning("  Sampath: API error %s for %s", raw["__error"], api_url)
            return None
        return raw


# ── Module-level helpers ──────────────────────────────────────────────────────

def _extract_items(raw) -> list[dict]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in ("data", "promotions", "results", "items", "offers", "content"):
            if key in raw and isinstance(raw[key], list):
                return raw[key]
    return []


def _extract_total(raw) -> int | None:
    if isinstance(raw, dict):
        for key in ("total", "totalCount", "count", "total_count", "totalItems"):
            if key in raw and isinstance(raw[key], int):
                return raw[key]
    return None


def _get(item: dict, *keys: str) -> str:
    """Return the first non-empty value among the given key variants."""
    for k in keys:
        v = item.get(k)
        if v and str(v).strip():
            return clean_text(str(v))
    return ""


def _strip_html(html_text: str) -> str:
    """Strip HTML tags, return clean plain text."""
    if not html_text:
        return ""
    try:
        return BeautifulSoup(html_text, "lxml").get_text(separator=" ", strip=True)
    except Exception:
        return re.sub(r"<[^>]+>", " ", html_text).strip()


def _item_to_offer(item: dict, category: str) -> ScrapedOffer | None:
    """
    Convert one Sampath API item to a ScrapedOffer.

    Confirmed field mapping:
      company_name  → title (merchant name / offer subject)
      description   → HTML offer detail text (strip tags)
      discount      → discount % (often null; extract from description instead)
      promotion_period → date range (often empty)
      city          → location context
    """
    # Title — confirmed: company_name
    title = _get(item, "company_name", "title", "name", "heading")
    if not title or len(title) < 3:
        return None

    # Description — strip HTML tags
    raw_html = _get(item, "description", "content", "details")
    description = _strip_html(raw_html) if raw_html else None

    # Merchant = company name
    merchant = title  # company_name is the merchant

    # Discount — explicit field often null; fall back to extracting from description
    discount_raw = _get(item, "discount", "discountText", "discount_text")
    if not discount_raw and description:
        discount_raw = description
    discount = extract_discount(discount_raw) if discount_raw else None

    # City
    city = _get(item, "city", "location") or None

    # Dates — try explicit date fields, then text extractor
    valid_from = _parse_date(
        item.get("valid_from") or item.get("validFrom") or item.get("start_date")
    )
    valid_to = _parse_date(
        item.get("valid_to") or item.get("validTo") or
        item.get("end_date") or item.get("endDate") or item.get("expiry_date")
    )
    if not valid_to:
        period = _get(item, "promotion_period", "validPeriod", "period") or ""
        text_for_dates = f"{period} {description or ''}".strip()
        if text_for_dates:
            ext = extract_dates(text_for_dates)
            valid_from = valid_from or ext.get("valid_from")
            valid_to   = valid_to   or ext.get("valid_to")

    # Source URL
    slug = _get(item, "slug", "url", "link")
    if slug and not slug.startswith("http"):
        slug = f"{_BASE_URL}{slug}" if slug.startswith("/") else None
    source_url = slug or f"{_PAGE_URL}?firstTab={category}"

    # Build raw_text for the candidate record
    raw_parts: list[str] = [title]
    if description:
        raw_parts.append(description[:300])
    if city:
        raw_parts.append(f"Location: {city}")
    raw_parts.append(f"Category: {category}")
    if valid_to:
        raw_parts.append(f"Valid to: {valid_to.isoformat()}")
    raw_text = " | ".join(raw_parts)

    # Confidence — API data is structured, so start high
    score = 0.65
    if discount:    score += 0.15
    if valid_to:    score += 0.10
    if valid_from:  score += 0.05
    if description: score += 0.05

    candidate_hash = generate_candidate_hash(
        source_url, title, discount,
        valid_to.isoformat() if valid_to else None,
        raw_text,
    )

    return ScrapedOffer(
        title=title,
        description=description[:500] if description else None,
        raw_text=truncate(raw_text, 2000),
        source_url=source_url,
        detected_merchant=merchant,
        detected_discount=discount,
        detected_valid_from=valid_from,
        detected_valid_to=valid_to,
        confidence_score=round(min(score, 1.0), 2),
        candidate_hash=candidate_hash,
    )


def _parse_date(value) -> date | None:
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        # ISO: 2026-12-31 or 2026-12-31T00:00:00
        if len(s) >= 10 and s[4] == "-":
            parts = s[:10].split("-")
            return date(int(parts[0]), int(parts[1]), int(parts[2]))
        # dd/mm/yyyy or dd-mm-yyyy
        for sep in ("/", "-", "."):
            if sep in s:
                parts = s.split(sep)
                if len(parts) == 3 and len(parts[-1]) == 4:
                    return date(int(parts[2]), int(parts[1]), int(parts[0]))
    except Exception:
        pass
    return None
