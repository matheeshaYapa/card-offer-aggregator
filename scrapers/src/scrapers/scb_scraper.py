"""
Standard Chartered Bank (SCB) promotions scraper.

Target: https://www.sc.com/lk/promotions/the-good-life-privileges/

The page is a JavaScript SPA — offer cards are rendered by React/JS
after the initial HTML loads. Plain requests returns a near-empty shell.

Card interaction pattern (confirmed by user):
  - A grid of offer cards is visible after JS renders.
  - Clicking a card opens a POPUP/MODAL with full offer details
    (description, dates, terms, eligible cards).
  - The popup content is NOT available in the initial DOM — it appears
    only after a click event.

Strategy:
  1. Playwright loads the page (no Cloudflare, just JS rendering).
  2. Wait for offer cards to appear in the DOM.
  3. Use page.evaluate() to scan the rendered DOM and log its structure
     (diagnostic on first run — helps tune selectors).
  4. For each card: click → wait for modal → extract modal content.
  5. Close modal → next card.

NOTE ON SELECTORS:
  SC's CMS changes class names with each deployment. On first run the
  scraper logs the raw DOM structure at INFO level so you can identify
  the correct selectors and update _CARD_SELECTORS / _MODAL_SELECTORS
  below. The current values are best-effort guesses based on SC's
  typical global website patterns.
"""
import json
import re
import time

from bs4 import BeautifulSoup

from src.extractors.date_extractor import extract_dates
from src.extractors.discount_extractor import extract_discount
from src.models.scraped_offer import ScrapedOffer
from src.scrapers.base_scraper import BaseScraper
from src.utils.hashing import generate_candidate_hash
from src.utils.logger import get_logger
from src.utils.text_cleaner import clean_text, truncate

logger = get_logger(__name__)

_PAGE_URL = "https://www.sc.com/lk/promotions/the-good-life-privileges/"

# ── Tunable selectors ─────────────────────────────────────────────────────────
# Update these after inspecting the first-run DOM diagnostic logs.

# CSS selectors tried in order to find individual offer cards in the rendered DOM
_CARD_SELECTORS = [
    # SC global website common patterns
    ".sc-promo-card",
    ".promotion-card",
    ".offer-card",
    "[class*='PromotionCard']",
    "[class*='PromoCard']",
    "[class*='offer-item']",
    "[class*='promo-tile']",
    # Generic fallback — any article or li with an image and a heading
    "article",
    "li.item",
]

# CSS selectors tried to find the popup/modal AFTER a card is clicked
_MODAL_SELECTORS = [
    ".sc-modal",
    ".modal-content",
    "[class*='Modal']",
    "[class*='modal']",
    "[role='dialog']",
    "[aria-modal='true']",
    ".overlay-content",
    ".popup-content",
    ".lightbox",
]


class SCBScraper(BaseScraper):

    # ── Entry point ───────────────────────────────────────────────────────

    def run(self) -> list[ScrapedOffer]:
        try:
            from playwright.sync_api import sync_playwright  # noqa: PLC0415
        except ImportError:
            logger.error("  SCB: Playwright not installed. Run: python -m playwright install --with-deps chromium")
            return []

        candidates: list[ScrapedOffer] = []
        seen_hashes: set[str] = set()

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage",
                      "--disable-blink-features=AutomationControlled"],
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/147.0.0.0 Safari/537.36"
                ),
                locale="en-LK",
                timezone_id="Asia/Colombo",
                viewport={"width": 1440, "height": 900},
            )
            context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            )
            page = context.new_page()

            logger.info("  SCB: loading page …")
            try:
                page.goto(_PAGE_URL, wait_until="domcontentloaded", timeout=30_000)
                time.sleep(5)   # Let React/JS fully render
            except Exception as exc:
                logger.error("  SCB: failed to load page: %s", exc)
                browser.close()
                return []

            # ── Diagnostic: log DOM structure to help tune selectors ──────
            dom_info = self._log_dom_diagnostic(page)
            logger.info("  SCB: DOM diagnostic: %s", json.dumps(dom_info, ensure_ascii=False)[:500])

            # ── Find offer cards ──────────────────────────────────────────
            card_selector, card_count = self._find_card_selector(page)
            if not card_selector:
                logger.warning(
                    "  SCB: no card selector matched. Check diagnostic log above "
                    "and update _CARD_SELECTORS in scb_scraper.py."
                )
                browser.close()
                return []

            logger.info("  SCB: found %d card(s) using selector '%s'", card_count, card_selector)

            # ── Scrape each card ──────────────────────────────────────────
            for i in range(card_count):
                try:
                    offer = self._scrape_card(page, card_selector, i)
                    if offer and offer.candidate_hash not in seen_hashes:
                        seen_hashes.add(offer.candidate_hash)
                        candidates.append(offer)
                        logger.debug(
                            "  SCB: card %d/%d → %s", i + 1, card_count, offer.title[:40]
                        )
                except Exception as exc:
                    logger.warning("  SCB: card %d failed: %s", i + 1, exc)
                time.sleep(0.5)

            browser.close()

        logger.info("  SCB: %d unique candidate(s) total", len(candidates))
        return candidates

    def parse(self, html: str) -> list[ScrapedOffer]:  # pragma: no cover
        return []

    # ── DOM discovery ─────────────────────────────────────────────────────

    def _log_dom_diagnostic(self, page) -> dict:
        """
        Inspect the rendered DOM to help identify the correct card/modal selectors.
        Output appears in scraper logs — use it to tune _CARD_SELECTORS.
        """
        try:
            return page.evaluate("""
                () => {
                    const info = {};
                    // Count elements by tag
                    info.h2Count = document.querySelectorAll('h2').length;
                    info.h3Count = document.querySelectorAll('h3').length;
                    info.articleCount = document.querySelectorAll('article').length;
                    // Sample classes from divs that have headings inside
                    const promoLike = [];
                    document.querySelectorAll('div, li, article').forEach(el => {
                        if (el.querySelector('h2,h3,h4') && el.querySelector('img')) {
                            const cls = el.className;
                            if (cls && !promoLike.includes(cls.trim().split(' ')[0])) {
                                promoLike.push(cls.trim().split(' ')[0]);
                            }
                        }
                    });
                    info.possibleCardClasses = promoLike.slice(0, 10);
                    // First h2 and h3 texts
                    info.firstH2 = document.querySelector('h2')?.textContent?.trim().substring(0, 60);
                    info.firstH3 = document.querySelector('h3')?.textContent?.trim().substring(0, 60);
                    return info;
                }
            """)
        except Exception as exc:
            return {"error": str(exc)}

    def _find_card_selector(self, page) -> tuple[str | None, int]:
        """Try each selector in _CARD_SELECTORS; return the first that matches."""
        for selector in _CARD_SELECTORS:
            try:
                count = page.evaluate(
                    f"() => document.querySelectorAll({json.dumps(selector)}).length"
                )
                if count and count > 0:
                    return selector, count
            except Exception:
                pass
        return None, 0

    # ── Per-card scraping with popup click ────────────────────────────────

    def _scrape_card(self, page, card_selector: str, index: int) -> ScrapedOffer | None:
        """
        Scrape one card: click it to open the modal, extract modal content,
        then close the modal.
        """
        # Get visible card data before clicking
        card_data = page.evaluate(
            f"""
            (idx) => {{
                const cards = document.querySelectorAll({json.dumps(card_selector)});
                const card = cards[idx];
                if (!card) return null;
                return {{
                    title: card.querySelector('h2,h3,h4')?.textContent?.trim(),
                    desc:  card.querySelector('p')?.textContent?.trim(),
                    allText: card.textContent?.trim().replace(/\\s+/g, ' ').substring(0, 300),
                }};
            }}
            """,
            index,
        )

        if not card_data:
            return None

        # Try clicking the card to open popup
        modal_data = self._click_and_extract_modal(page, card_selector, index)

        # Merge card + modal data
        title       = clean_text(card_data.get("title") or "")
        description = None
        date_text   = ""

        if modal_data:
            modal_text = modal_data.get("fullText", "")
            description = clean_text(modal_data.get("desc") or card_data.get("desc") or "")
            date_text   = modal_data.get("dateText", "")
        else:
            description = clean_text(card_data.get("desc") or "")
            date_text   = _extract_date_from_text(card_data.get("allText", ""))

        if not title or len(title) < 3:
            return None

        # Dates
        dates      = extract_dates(f"{date_text} {description}".strip())
        valid_from = dates.get("valid_from")
        valid_to   = dates.get("valid_to")

        # Discount
        discount = extract_discount(title + " " + (description or "")) or None

        raw_parts = [title]
        if description: raw_parts.append(description[:300])
        if date_text:   raw_parts.append(date_text)
        raw_text = " | ".join(raw_parts)

        score = 0.55
        if discount:    score += 0.15
        if valid_to:    score += 0.15
        if valid_from:  score += 0.05
        if description: score += 0.10

        ch = generate_candidate_hash(
            _PAGE_URL, title, discount,
            valid_to.isoformat() if valid_to else None,
            raw_text,
        )

        return ScrapedOffer(
            title=title,
            description=description[:500] if description else None,
            raw_text=truncate(raw_text, 2000),
            source_url=_PAGE_URL,
            detected_merchant=title,
            detected_discount=discount,
            detected_valid_from=valid_from,
            detected_valid_to=valid_to,
            confidence_score=round(min(score, 1.0), 2),
            candidate_hash=ch,
        )

    def _click_and_extract_modal(self, page, card_selector: str, index: int) -> dict | None:
        """
        Click a card at the given index, wait for a modal to appear,
        extract its content, then close it.
        Returns dict with 'desc', 'dateText', 'fullText', or None on failure.
        """
        try:
            # Click the card
            page.evaluate(
                f"""
                (idx) => {{
                    const cards = document.querySelectorAll({json.dumps(card_selector)});
                    const card = cards[idx];
                    if (card) {{
                        // Try the card itself, then its first link/button
                        const clickable = card.querySelector('a,button') || card;
                        clickable.click();
                    }}
                }}
                """,
                index,
            )
            time.sleep(1.5)   # Wait for modal animation

            # Try to find and extract modal content
            modal_content = page.evaluate(
                f"""
                () => {{
                    const selectors = {json.dumps(_MODAL_SELECTORS)};
                    for (const sel of selectors) {{
                        const modal = document.querySelector(sel);
                        if (modal && modal.offsetParent !== null) {{   // visible
                            const headings = Array.from(modal.querySelectorAll('h1,h2,h3,h4'))
                                .map(h => h.textContent.trim()).filter(Boolean);
                            const paras = Array.from(modal.querySelectorAll('p'))
                                .map(p => p.textContent.trim()).filter(t => t.length > 5);
                            const allText = modal.textContent.replace(/\\s+/g, ' ').trim();
                            return {{
                                selector: sel,
                                desc: paras[0] || headings[0] || '',
                                dateText: paras.find(p =>
                                    /valid|till|until|from|\\b20[2-9]\\d\\b/i.test(p)) || '',
                                fullText: allText.substring(0, 800),
                            }};
                        }}
                    }}
                    return null;
                }}
                """
            )

            # Close modal — try common close patterns
            page.evaluate("""
                () => {
                    const close = document.querySelector(
                        '[aria-label="close"], .modal-close, .close-btn, '
                        '[class*="close"], [class*="Close"], button[class*="modal"]'
                    );
                    if (close) close.click();
                    // Fallback: press Escape
                }
            """)
            page.keyboard.press("Escape")
            time.sleep(0.5)

            return modal_content

        except Exception as exc:
            logger.debug("  SCB: modal extraction failed for card %d: %s", index, exc)
            return None


# ── Module helper ─────────────────────────────────────────────────────────────

def _extract_date_from_text(text: str) -> str:
    """Pull the first date-like sentence from a block of text."""
    for sentence in re.split(r"[.!?]|\n", text):
        if re.search(r"valid|till|until|from|period|\b20[2-9]\d\b", sentence, re.IGNORECASE):
            return clean_text(sentence)
    return ""
