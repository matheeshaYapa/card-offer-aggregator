"""
Sampath Bank promotions scraper.

Target: https://www.sampath.lk/sampath-cards/credit-card-offer

PROBLEM: sampath.lk is behind Cloudflare's bot-protection layer.
A plain requests.get() returns HTTP 503.

STRATEGY (tried in order):
  1. cloudscraper — lightweight library that solves Cloudflare JS challenges
     without needing a real browser binary.
  2. Playwright — headless Chromium; used only if cloudscraper succeeds in
     fetching the page but the page turns out to be a JS SPA (empty shell).
  3. Log a clear warning and skip if both approaches fail, so the rest of
     the scraper run continues unaffected.

TAB COVERAGE:
  The site uses ?firstTab= query params for category tabs.  We iterate over
  all known tab slugs so each category is scraped, then deduplicate.

ADDING NEW SELECTORS:
  If Sampath redesigns their site, inspect the rendered DOM and add new
  CSS selectors to _CANDIDATE_SELECTORS (most-specific first).
"""
import time

from bs4 import BeautifulSoup, Tag

from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.logger import get_logger

logger = get_logger(__name__)

_PROMO_BASE = "https://www.sampath.lk/sampath-cards/credit-card-offer"

# Known tab slugs for the ?firstTab= parameter.
# Fetching each gives content for that category even if JS doesn't run.
_TAB_SLUGS = [
    "hotels",
    "restaurants",
    "supermarkets",
    "shopping",
    "travel",
    "health",
    "entertainment",
    "fuel",
    "lifestyle",
    "online",
]

# CSS selectors tried in priority order (most-specific → generic).
# Update these if Sampath changes their markup.
_CANDIDATE_SELECTORS = [
    # Specific patterns to try first
    ".offer-item",
    ".promotion-item",
    ".card-offer-item",
    ".promo-item",
    ".offer-card",
    ".promo-card",
    ".promotion-card",
    # Attribute-based fallbacks
    "[class*='offer-item']",
    "[class*='promo-item']",
    "[class*='offer-card']",
    # Bootstrap column grid (common in Sri Lankan bank sites)
    ".col-md-4.offer",
    ".col-sm-6.promo",
    ".col-md-4",
    # Semantic elements
    "article",
    "li.offer",
]

# Minimum visible-text length to consider a page "real content" vs an SPA shell
_MIN_CONTENT_CHARS = 400


class SampathScraper(BaseScraper):

    # ── Public entry point ────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        """
        Fetch the main page plus each category tab, merge unique candidates.
        Overrides BaseScraper.run() to iterate multiple URLs.
        """
        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        urls_to_try = [self.source_url] + [
            f"{_PROMO_BASE}?firstTab={slug}" for slug in _TAB_SLUGS
        ]

        for url in urls_to_try:
            html = self._safe_fetch(url)
            if not html:
                continue

            # If the page looks like a JS SPA shell, escalate to Playwright
            if _is_empty_shell(html):
                logger.info("  Sampath: %s returned JS-only shell — trying Playwright", url)
                html = self._fetch_with_playwright(url)

            if not html or _is_empty_shell(html):
                logger.warning(
                    "  Sampath: could not get real content from %s (both methods failed)", url
                )
                continue

            try:
                page_offers = self.parse(html)
            except Exception as exc:
                logger.warning("  Sampath: parse failed for %s: %s", url, exc)
                continue

            new_count = 0
            for offer in page_offers:
                if offer.candidate_hash not in seen_hashes:
                    seen_hashes.add(offer.candidate_hash)
                    candidates.append(offer)
                    new_count += 1

            logger.debug("  Sampath: %s → %d new candidate(s)", url, new_count)
            time.sleep(1.0)   # respectful rate limit — Sampath has bot protection

        logger.info("  Sampath: %d total unique candidate(s) across all tabs", len(candidates))
        return candidates

    # ── Fetch strategies ──────────────────────────────────────────────────

    def _safe_fetch(self, url: str) -> str:
        """
        Try cloudscraper first; fall back to plain requests on ImportError.
        Returns empty string on any network/HTTP error.
        """
        try:
            import cloudscraper   # noqa: PLC0415
            cs = cloudscraper.create_scraper(
                browser={
                    "browser": "chrome",
                    "platform": "windows",
                    "mobile": False,
                }
            )
            logger.info("  Sampath: fetching %s via cloudscraper", url)
            resp = cs.get(url, timeout=30)
            resp.raise_for_status()
            return resp.text

        except ImportError:
            logger.warning(
                "  Sampath: cloudscraper not installed — falling back to requests. "
                "Add 'cloudscraper' to requirements.txt for best results."
            )
        except Exception as exc:
            logger.warning("  Sampath: cloudscraper failed for %s: %s", url, exc)

        # Plain requests fallback
        try:
            return super().fetch_html(url)
        except Exception as exc:
            logger.warning("  Sampath: requests also failed for %s: %s", url, exc)
            return ""

    def _fetch_with_playwright(self, url: str) -> str:
        """
        Render the page with headless Chromium via Playwright.

        Requires:  playwright >= 1.44 (already in requirements.txt)
        Browser:   python -m playwright install --with-deps chromium
                   (run once locally; add as a CI step if needed)
        """
        try:
            from playwright.sync_api import sync_playwright  # noqa: PLC0415
        except ImportError:
            logger.warning("  Sampath: Playwright package not installed")
            return ""

        logger.info("  Sampath: rendering %s with Playwright (headless Chromium)", url)
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    )
                )
                page.goto(url, wait_until="networkidle", timeout=30_000)
                html = page.content()
                browser.close()
            return html
        except Exception as exc:
            logger.warning("  Sampath: Playwright render failed for %s: %s", url, exc)
            return ""

    # ── Parsing ───────────────────────────────────────────────────────────

    def parse(self, html: str) -> list[ScrapedOffer]:
        soup = BeautifulSoup(html, "lxml")

        blocks: list[Tag] = []
        for selector in _CANDIDATE_SELECTORS:
            found = soup.select(selector)
            if found:
                logger.debug(
                    "  Sampath: matched selector '%s' → %d block(s)", selector, len(found)
                )
                blocks = found
                break

        if not blocks:
            logger.info("  Sampath: no CSS selector matched — using generic parser")
            return self._generic_parse(html)

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        for block in blocks:
            offer = self._extract_from_block(block)
            if offer and offer.candidate_hash not in seen_hashes:
                seen_hashes.add(offer.candidate_hash)
                candidates.append(offer)

        return candidates


# ── Module-level helpers ──────────────────────────────────────────────────────

def _is_empty_shell(html: str) -> bool:
    """
    Return True if the page looks like a JS SPA shell with no real content.
    Strips script/style/head/nav/footer then checks visible text length.
    """
    if not html or len(html) < 500:
        return True
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "head", "nav", "footer", "header"]):
        tag.decompose()
    visible = soup.get_text(separator=" ", strip=True)
    return len(visible) < _MIN_CONTENT_CHARS
