"""
Cleanup expired offers + scraped candidates.

Deletes records whose valid_to (or detected_valid_to for candidates) is more
than CLEANUP_DAYS days before today. Records with NULL valid dates are kept.

Runs daily after the scraper via GitHub Actions, or manually:
    python cleanup_expired.py

Uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
"""
from __future__ import annotations

import os
import sys
from datetime import date, timedelta

from dotenv import load_dotenv
from supabase import create_client


CLEANUP_DAYS = 7


def main() -> int:
    load_dotenv()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required", file=sys.stderr)
        return 1

    client = create_client(url, key)
    cutoff = (date.today() - timedelta(days=CLEANUP_DAYS)).isoformat()

    print(f"=== Cleanup expired records (cutoff: < {cutoff}) ===")

    # ── 1. Offers ────────────────────────────────────────────────────────
    try:
        result = (
            client.table("offers")
            .delete()
            .not_.is_("valid_to", "null")
            .lt("valid_to", cutoff)
            .execute()
        )
        deleted_offers = len(result.data or [])
        print(f"Deleted {deleted_offers} expired offer(s)")
    except Exception as e:
        print(f"ERROR deleting offers: {e}", file=sys.stderr)
        return 1

    # ── 2. Scraped candidates ────────────────────────────────────────────
    try:
        result = (
            client.table("scraped_offer_candidates")
            .delete()
            .not_.is_("detected_valid_to", "null")
            .lt("detected_valid_to", cutoff)
            .execute()
        )
        deleted_candidates = len(result.data or [])
        print(f"Deleted {deleted_candidates} expired candidate(s)")
    except Exception as e:
        print(f"ERROR deleting candidates: {e}", file=sys.stderr)
        return 1

    print("=== Cleanup complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
