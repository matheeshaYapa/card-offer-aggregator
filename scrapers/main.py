#!/usr/bin/env python3
"""
CardPromo LK — Scraper Orchestrator
=====================================
Loads active scrape sources from Supabase,
runs the appropriate bank scraper for each source, saves candidates
to `scraped_offer_candidates`, and records execution in `scrape_runs`.

Usage:
    cd scrapers
    python main.py

Requires:
    .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
"""
import sys
from argparse import ArgumentParser
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Ensure src/ is importable from the scrapers/ root directory
sys.path.insert(0, str(Path(__file__).parent))

import yaml
from dotenv import load_dotenv

from src.db.supabase_client import SupabaseDB
from src.scrapers.base_scraper import GenericScraper
from src.scrapers.amana_scraper import AmanaScraper
from src.scrapers.boc_scraper import BOCScraper
from src.scrapers.union_bank_scraper import UnionBankScraper
from src.scrapers.commercial_bank_scraper import CommercialBankScraper
from src.scrapers.dfcc_scraper import DFCCScraper
from src.scrapers.hnb_scraper import HNBScraper
from src.scrapers.ndb_scraper import NDBScraper
from src.scrapers.ntb_scraper import NTBScraper
from src.scrapers.peoples_bank_scraper import PeoplesBankScraper
from src.scrapers.sampath_scraper import SampathScraper
from src.scrapers.seylan_scraper import SeylanScraper
from src.utils.logger import get_logger
from src.scrape_quality import auto_publish_blockers, local_today
from src.confidence import assess_batch

load_dotenv()
logger = get_logger("main")

# A source that suddenly returns far fewer offers than last time has usually
# changed its page layout; its run is marked partial so someone looks at it.
DRIFT_MIN_PREVIOUS = 10
DRIFT_DROP_SHARE = 0.5

# Map bank_slug → scraper class
SCRAPER_MAP: dict[str, type] = {
    "hnb": HNBScraper,
    "commercial-bank": CommercialBankScraper,
    "dfcc-bank": DFCCScraper,
    "sampath-bank": SampathScraper,
    "boc": BOCScraper,
    "peoples-bank": PeoplesBankScraper,
    "seylan-bank": SeylanScraper,
    "nations-trust-bank": NTBScraper,
    "ndb-bank": NDBScraper,
    "amana-bank": AmanaScraper,
    "union-bank": UnionBankScraper,
}


def load_fallback_sources() -> list[dict]:
    """Load source configuration for read-only audits."""
    config_path = Path(__file__).parent / "config" / "sources.yaml"
    if not config_path.exists():
        logger.warning("config/sources.yaml not found")
        return []
    with open(config_path, encoding="utf-8-sig") as f:
        config = yaml.safe_load(f)
    return [source for source in config.get("sources", []) if source.get("enabled", True)]


def get_scraper(source: dict):
    """Return the correct scraper instance for a source."""
    bank_slug = source.get("bank_slug") or source.get("scraper", "")
    cls = SCRAPER_MAP.get(bank_slug, GenericScraper)
    return cls(source)


def score_batch(scraper, offers: list) -> list:
    """Re-score a source's offers with the evidence checks in src/confidence.py."""
    offers, report = assess_batch(offers, local_today())
    categorised = sum(bool(o.detected_category) for o in offers)
    logger.info(
        "  Quality: %s; %d/%d categorised", report.summary(), categorised, len(offers),
    )
    if report.anomaly:
        scraper.flag_issue(f"Parser drift suspected — {report.summary()}; auto-publish held for this source")
    return offers


def audit_source(source: dict) -> bool:
    scraper = get_scraper(source)
    bank = source["bank_slug"]
    try:
        offers = score_batch(scraper, scraper.run_checked())
    except Exception as exc:
        logger.error("AUDIT %s failed: %s", bank, exc)
        return False

    checks = [auto_publish_blockers(offer, source) for offer in offers]
    blockers = Counter(reason for reasons in checks for reason in reasons)
    categories = Counter(offer.detected_category or "(none)" for offer in offers)
    logger.info(
        "AUDIT %s %s: %d extracted, %d eligible for auto-publish, review reasons %s, categories %s",
        bank, "partial" if scraper.issues else "success", len(offers),
        sum(not reasons for reasons in checks), dict(blockers), dict(categories),
    )
    if args_verbose():
        for offer, reasons in zip(offers, checks):
            logger.info(
                "  %.2f %-12s %-60.60s %s", offer.confidence_score, offer.detected_category or "-",
                offer.title or "", "; ".join(reasons) or "auto-publish",
            )
    return not scraper.issues


_VERBOSE = False


def args_verbose() -> bool:
    return _VERBOSE


def main() -> int:
    parser = ArgumentParser(description="Collect CardPromo LK bank offers")
    parser.add_argument("--audit", action="store_true", help="Check configured sources without database access")
    parser.add_argument("--bank", choices=sorted(SCRAPER_MAP), help="Check only this bank in audit mode")
    parser.add_argument("--verbose", action="store_true", help="In audit mode, list every offer with its score and blockers")
    args = parser.parse_args()
    global _VERBOSE
    _VERBOSE = args.verbose
    if args.bank and not args.audit:
        parser.error("--bank requires --audit")
    if args.audit:
        sources = [
            source for source in load_fallback_sources()
            if not args.bank or source["bank_slug"] == args.bank
        ]
        with ThreadPoolExecutor(max_workers=4) as workers:
            results = list(workers.map(audit_source, sources))
        return 0 if results and all(results) else 1

    logger.info("=" * 60)
    logger.info("CardPromo LK Scraper starting")
    logger.info("=" * 60)

    # ── Connect to Supabase ──────────────────────────────────────────────
    db = SupabaseDB()

    sources = db.get_active_sources()
    if not sources:
        logger.error("No active scrape sources configured in Supabase.")
        return 1

    # ── Process each source ───────────────────────────────────────────────
    total_new = 0
    total_skipped = 0
    total_auto_published = 0
    unhealthy_sources = 0

    for source in sources:
        source_name = source.get("name", "unknown")
        source_id: str | None = source.get("id")
        logger.info("")
        logger.info("→ Source: %s (%s)", source_name, source.get("source_url", ""))

        run_id = db.create_scrape_run(source_id)

        offers = []
        try:
            scraper = get_scraper(source)
            offers = scraper.run_checked()
            logger.info("  Extracted %d candidate(s)", len(offers))
            offers = score_batch(scraper, offers)
            previous = db.last_successful_count(source_id)
            if previous and previous >= DRIFT_MIN_PREVIOUS and len(offers) < previous * DRIFT_DROP_SHARE:
                scraper.flag_issue(
                    f"Offer count dropped from {previous} to {len(offers)} since the last successful run"
                )

            new_count = 0
            auto_published_count = 0
            expired_count = 0
            today = local_today()
            for offer in offers:
                if offer.detected_valid_to and offer.detected_valid_to < today:
                    expired_count += 1
                    continue
                inserted, auto_published = db.insert_candidate(offer, run_id, source_id, source)
                if inserted:
                    new_count += 1
                if auto_published:
                    auto_published_count += 1

            skipped = len(offers) - new_count - expired_count
            total_new += new_count
            total_skipped += skipped
            total_auto_published += auto_published_count
            logger.info(
                "  ✓ %d new | %d duplicates | %d expired | %d auto-published",
                new_count, skipped, expired_count, auto_published_count,
            )

            if scraper.issues:
                unhealthy_sources += 1
                db.update_scrape_run(run_id, "partial", len(offers), "\n".join(scraper.issues))
            else:
                db.update_scrape_run(run_id, "success", len(offers))
                db.update_source_last_scraped(source_id)

        except Exception as exc:
            unhealthy_sources += 1
            logger.error("  ✗ Scrape failed: %s", exc, exc_info=True)
            db.update_scrape_run(run_id, "failed", len(offers), str(exc))

    logger.info("")
    logger.info("=" * 60)
    logger.info(
        "Done. New candidates: %d | Duplicates skipped: %d | Auto-published: %d",
        total_new, total_skipped, total_auto_published,
    )
    logger.info("=" * 60)
    logger.info("Review candidates at: /admin/scraped-candidates")
    return 1 if unhealthy_sources else 0


if __name__ == "__main__":
    sys.exit(main())
