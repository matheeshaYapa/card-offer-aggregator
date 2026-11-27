#!/usr/bin/env python3
"""
Measure how well confidence scores predict admin decisions.

Takes every candidate an admin approved or rejected, re-scores it with the
current checks (src/confidence.py, grouped by scrape run so batch checks
work), and reports:

* precision at each threshold: of the candidates scoring at or above it,
  how many did admins approve? This is what auto-publishing would get right.
* how many good offers each threshold would still send to review.
* the rejection rate for each quality flag, to show which checks pull weight
  and which penalties to raise or lower.

Usage (from scrapers/, with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set):
    python calibrate_confidence.py
    python calibrate_confidence.py --include-legacy   # count pre-010 approvals as admin approvals

Re-run after a few weeks of reviews and adjust AUTO_PUBLISH_THRESHOLD
(src/scrape_quality.py) or PENALTIES (src/confidence.py) to match.
"""
import sys
from argparse import ArgumentParser
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.confidence import assess_batch
from src.db.supabase_client import get_supabase_client
from src.models.scraped_offer import ScrapedOffer
from src.scrape_quality import AUTO_PUBLISH_THRESHOLD

THRESHOLDS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
FIELDS = ("id, scrape_run_id, title, description, raw_text, source_url, detected_merchant, detected_discount, "
          "detected_valid_from, detected_valid_to, confidence_score, parser_score, candidate_hash, status, "
          "review_source, created_at")


def main() -> int:
    parser = ArgumentParser(description="Calibrate scraper confidence against admin reviews")
    parser.add_argument("--include-legacy", action="store_true",
                        help="Treat approvals with unknown reviewer (before migration 010) as admin approvals")
    args = parser.parse_args()

    db = get_supabase_client()
    rows, start = [], 0
    while True:
        batch = (db.table("scraped_offer_candidates").select(FIELDS)
                 .in_("status", ["approved", "rejected", "duplicate"]).order("id")
                 .range(start, start + 999).execute().data or [])
        rows.extend(batch)
        if len(batch) < 1000:
            break
        start += 1000

    labelled = [
        r for r in rows
        if r["review_source"] == "admin" or (args.include_legacy and r["review_source"] is None)
    ]
    if not labelled:
        print("No admin-reviewed candidates yet. Review some in /admin/scraped-candidates and re-run.")
        return 0

    by_run: dict[str, list[dict]] = defaultdict(list)
    for r in labelled:
        by_run[r["scrape_run_id"] or r["id"]].append(r)

    scored: list[tuple[float, bool, list[str]]] = []
    for run_rows in by_run.values():
        offers = [
            ScrapedOffer(
                title=r["title"], description=r["description"], raw_text=r["raw_text"] or "",
                source_url=r["source_url"] or "", detected_merchant=r["detected_merchant"],
                detected_discount=r["detected_discount"],
                detected_valid_from=r["detected_valid_from"], detected_valid_to=r["detected_valid_to"],
                confidence_score=float(r["parser_score"] or r["confidence_score"] or 0),
                candidate_hash=r["candidate_hash"] or r["id"],
            )
            for r in run_rows
        ]
        # Judge dates as of when the candidate was scraped, not today.
        as_of = date.fromisoformat(run_rows[0]["created_at"][:10])
        assessed, _ = assess_batch(offers, as_of)
        for r, offer in zip(run_rows, assessed):
            scored.append((offer.confidence_score, r["status"] == "approved", offer.quality_flags))

    total_good = sum(good for _, good, _ in scored)
    print(f"Admin-reviewed candidates: {len(scored)} ({total_good} approved, {len(scored) - total_good} rejected)\n")
    print(f"{'threshold':>9}  {'would publish':>13}  {'precision':>9}  {'good offers held':>16}")
    for t in THRESHOLDS:
        above = [good for s, good, _ in scored if s >= t]
        precision = sum(above) / len(above) if above else float("nan")
        held = total_good - sum(above)
        marker = "  <- current" if t == AUTO_PUBLISH_THRESHOLD else ""
        print(f"{t:>9.2f}  {len(above):>13}  {precision:>9.1%}  {held:>16}{marker}")

    flag_total, flag_rejected = Counter(), Counter()
    for _, good, flags in scored:
        for flag in flags:
            flag_total[flag] += 1
            flag_rejected[flag] += not good
    base = 1 - total_good / len(scored)
    print(f"\nRejection rate by flag (baseline {base:.0%}):")
    for flag, n in flag_total.most_common():
        print(f"  {flag:<26} {n:>5} candidates  {flag_rejected[flag] / n:>5.0%} rejected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
