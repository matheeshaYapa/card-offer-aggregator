#!/usr/bin/env python3
"""
CardPromo LK — Scraper Orchestrator
=====================================
Loads active scrape sources from Supabase (or YAML fallback),
runs the appropriate bank scraper for each source, saves candidates
to `scraped_offer_candidates`, and records execution in `scrape_runs`.

Usage:
    cd scrapers
    python main.py

Requires:
    .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
"""
import sys
from pathlib import Path

# Ensure src/ is importable from the scrapers/ root directory
sys.path.insert(0, str(Path(__file__).parent))

import yaml
from dotenv import load_dotenv

from src.db.supabase_client import SupabaseDB
from src.scrapers.base_scraper import GenericScraper
from src.scrapers.amana_scraper import AmanaScraper
from src.scrapers.boc_scraper import BOCScraper
from src.scrapers.scb_scraper import SCBScraper
from src.scrapers.union_bank_scraper import UnionBankScraper
from src.scrapers.commercial_bank_scraper import CommercialBankScraper
from src.scrapers.hnb_scraper import HNBScraper
from src.scrapers.ndb_scraper import NDBScraper
from src.scrapers.ntb_scraper import NTBScraper
from src.scrapers.peoples_bank_scraper import PeoplesBankScraper
from src.scrapers.sampath_scraper import SampathScraper
from src.scrapers.seylan_scraper import SeylanScraper
from src.utils.logger import get_logger

load_dotenv()
logger = get_logger("main")

# Map bank_slug → scraper class
SCRAPER_MAP: dict[str, type] = {
    "hnb": HNBScraper,
    "commercial-bank": CommercialBankScraper,
    "sampath-bank": SampathScraper,
    "boc": BOCScraper,
    "peoples-bank": PeoplesBankScraper,
    "seylan-bank": SeylanScraper,
    "nations-trust-bank": NTBScraper,
    "ndb-bank": NDBScraper,
    "amana-bank": AmanaScraper,
    "standard-chartered": SCBScraper,
    "union-bank": UnionBankScraper,
}


def load_fallback_sources() -> list[dict]:
    """Load source configuration from YAML when Supabase is unavailable."""
    config_path = Path(__file__).parent / "config" / "sources.yaml"
    if not config_path.exists():
        logger.warning("config/sources.yaml not found")
        return []
    with open(config_path) as f:
        config = yaml.safe_load(f)
    return config.get("sources", [])


def get_scraper(source: dict):
    """Return the correct scraper instance for a source."""
    bank_slug = source.get("bank_slug") or source.get("scraper", "")
    cls = SCRAPER_MAP.get(bank_slug, GenericScraper)
    return cls(source)


def main() -> None:
    logger.info("=" * 60)
    logger.info("CardPromo LK Scraper starting")
    logger.info("=" * 60)

    # ── Connect to Supabase ──────────────────────────────────────────────
    db = SupabaseDB()

    # ── Load sources ─────────────────────────────────────────────────────
    sources: list[dict] = []
    try:
        sources = db.get_active_sources()
        logger.info("Loaded %d active source(s) from Supabase", len(sources))
    except Exception as exc:
        logger.warning("Could not load sources from Supabase (%s). Trying YAML fallback.", exc)

    if not sources:
        sources = load_fallback_sources()
        logger.info("Using %d source(s) from YAML fallback", len(sources))

    if not sources:
        logger.error("No sources found. Add scrape_sources in Supabase or configure config/sources.yaml.")
        sys.exit(1)

    # ── Process each source ───────────────────────────────────────────────
    total_new = 0
    total_skipped = 0
    total_auto_published = 0

    for source in sources:
        source_name = source.get("name", "unknown")
        source_id: str | None = source.get("id")
        logger.info("")
        logger.info("→ Source: %s (%s)", source_name, source.get("source_url", ""))

        run_id = db.create_scrape_run(source_id)

        try:
            scraper = get_scraper(source)
            offers = scraper.run()
            logger.info("  Extracted %d candidate(s)", len(offers))

            new_count = 0
            auto_published_count = 0
            for offer in offers:
                inserted, auto_published = db.insert_candidate(offer, run_id, source_id, source)
                if inserted:
                    new_count += 1
                if auto_published:
                    auto_published_count += 1

            skipped = len(offers) - new_count
            total_new += new_count
            total_skipped += skipped
            total_auto_published += auto_published_count
            logger.info(
                "  ✓ %d new | %d duplicate(s) skipped | %d auto-published",
                new_count, skipped, auto_published_count,
            )

            db.update_scrape_run(run_id, "success", new_count)
            db.update_source_last_scraped(source_id)

        except Exception as exc:
            logger.error("  ✗ Scrape failed: %s", exc, exc_info=True)
            db.update_scrape_run(run_id, "failed", 0, str(exc))

    logger.info("")
    logger.info("=" * 60)
    logger.info(
        "Done. New candidates: %d | Duplicates skipped: %d | Auto-published: %d",
        total_new, total_skipped, total_auto_published,
    )
    logger.info("=" * 60)
    logger.info("Review candidates at: /admin/scraped-candidates")


if __name__ == "__main__":
    main()
