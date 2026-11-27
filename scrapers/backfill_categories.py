#!/usr/bin/env python3
"""
Assign categories to offers (and pending candidates) that have none.

Before this, scraped offers were published with category_id = NULL, so the
public category filter showed nothing for them. This script runs the same
classifier the scraper now uses (src/extractors/category_extractor.py) over
existing rows. Manually set categories are never overwritten.

Usage (from scrapers/, with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set):
    python backfill_categories.py            # dry run: prints what would change
    python backfill_categories.py --apply    # writes the changes
    python backfill_categories.py --apply --min-confidence 0.6

Apply migration 010 first so the automotive / education / services
categories exist.
"""
import sys
from argparse import ArgumentParser
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.db.supabase_client import get_supabase_client
from src.extractors.category_extractor import MIN_CONFIDENCE, classify
from src.utils.logger import get_logger

logger = get_logger("backfill")
PAGE = 500


def fetch_all(query_factory) -> list[dict]:
    rows: list[dict] = []
    for start in range(0, 100_000, PAGE):
        batch = query_factory().range(start, start + PAGE - 1).execute().data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            return rows
    return rows


def main() -> int:
    parser = ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true", help="Write changes (default is a dry run)")
    parser.add_argument("--min-confidence", type=float, default=MIN_CONFIDENCE)
    parser.add_argument("--show", type=int, default=15, help="Example rows to print per category")
    args = parser.parse_args()

    db = get_supabase_client()
    categories = {row["slug"]: row["id"] for row in db.table("categories").select("id, slug").eq("is_active", True).execute().data}
    missing = {"automotive", "education", "services"} - set(categories)
    if missing:
        logger.warning("Categories %s don't exist yet; apply migration 010 first. Offers for them stay uncategorised.", sorted(missing))

    offers = fetch_all(lambda: db.table("offers")
                       .select("id, title, description, merchant:merchants(name)")
                       .is_("category_id", "null").order("id"))
    raw_by_offer = {
        row["offer_id"]: row["raw_text"]
        for row in fetch_all(lambda: db.table("scraped_offer_candidates")
                             .select("offer_id, raw_text").not_.is_("offer_id", "null").order("id"))
    }
    logger.info("Offers without a category: %d", len(offers))

    planned: dict[str, list[str]] = {}
    examples: dict[str, list[str]] = {}
    skipped = Counter()
    for offer in offers:
        result = classify(
            offer["title"], offer.get("description"), (offer.get("merchant") or {}).get("name"),
            raw_by_offer.get(offer["id"]),
        )
        if not result.slug or result.confidence < args.min_confidence:
            skipped["low confidence"] += 1
            examples.setdefault("(left uncategorised)", []).append(f"{result.confidence:.2f}  {offer['title'][:80]}")
            continue
        if result.slug not in categories:
            skipped[f"category '{result.slug}' missing"] += 1
            continue
        planned.setdefault(result.slug, []).append(offer["id"])
        examples.setdefault(result.slug, []).append(f"{result.confidence:.2f}  {offer['title'][:80]}")

    for slug, rows in sorted(examples.items(), key=lambda item: -len(item[1])):
        logger.info("%s — %d", slug, len(rows))
        for line in rows[: args.show]:
            logger.info("    %s", line)
    logger.info("Will categorise %d offers; skipped %s", sum(map(len, planned.values())), dict(skipped))

    # Pending candidates: give reviewers (and the publisher) a pre-filled category.
    try:
        candidates = fetch_all(lambda: db.table("scraped_offer_candidates")
                               .select("id, title, description, detected_merchant, raw_text")
                               .eq("status", "pending").is_("detected_category_id", "null").order("id"))
    except Exception as exc:  # detected_category_id arrives with migration 010
        logger.warning("Skipping pending candidates (apply migration 010): %s", str(exc)[:120])
        candidates = []
    candidate_updates = []
    for cand in candidates:
        result = classify(cand["title"], cand.get("description"), cand.get("detected_merchant"), cand.get("raw_text"))
        if result.slug in categories and result.confidence >= args.min_confidence:
            candidate_updates.append((cand["id"], categories[result.slug], result.confidence))
    logger.info("Pending candidates to pre-categorise: %d of %d", len(candidate_updates), len(candidates))

    if not args.apply:
        logger.info("Dry run — re-run with --apply to write these changes.")
        return 0

    for slug, ids in planned.items():
        for start in range(0, len(ids), 200):
            (db.table("offers").update({"category_id": categories[slug]})
             .in_("id", ids[start:start + 200]).is_("category_id", "null").execute())
    for cand_id, category_id, confidence in candidate_updates:
        (db.table("scraped_offer_candidates")
         .update({"detected_category_id": category_id, "category_confidence": confidence})
         .eq("id", cand_id).execute())
    logger.info("Done. Rebuild the site (or wait for the nightly deploy) so category pages are re-rendered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
