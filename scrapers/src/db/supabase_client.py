"""
Supabase client and database operations for the scraper pipeline.

Uses the service role key which bypasses RLS — only safe in server-side/
GitHub Actions context. Never expose this key in frontend code.
"""
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client, Client

from src.models.scraped_offer import ScrapedOffer
from src.utils.logger import get_logger

logger = get_logger(__name__)


def get_supabase_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. "
            "Copy scrapers/.env.example to scrapers/.env and fill in values."
        )
    return create_client(url, key)


class SupabaseDB:
    """Wrapper around supabase-py for scraper pipeline operations."""

    def __init__(self) -> None:
        self.client = get_supabase_client()

    # ── Source management ────────────────────────────────────────────────

    def get_active_sources(self) -> list[dict]:
        """Return active scrape sources, joined with bank slug."""
        result = (
            self.client.table("scrape_sources")
            .select("*, bank:banks(slug)")
            .eq("is_active", True)
            .execute()
        )
        sources = result.data or []
        # Flatten bank slug into the source dict
        for s in sources:
            bank = s.pop("bank", None)
            s["bank_slug"] = (bank or {}).get("slug", "")
        return sources

    def update_source_last_scraped(self, source_id: str | None) -> None:
        if not source_id:
            return
        self.client.table("scrape_sources").update(
            {"last_scraped_at": _now()}
        ).eq("id", source_id).execute()

    # ── Scrape run lifecycle ─────────────────────────────────────────────

    def create_scrape_run(self, source_id: str | None) -> str:
        result = (
            self.client.table("scrape_runs")
            .insert({"scrape_source_id": source_id, "status": "running"})
            .execute()
        )
        run_id: str = result.data[0]["id"]
        logger.debug("Created scrape_run %s", run_id)
        return run_id

    def update_scrape_run(
        self,
        run_id: str,
        status: str,
        offers_found: int,
        error_message: str | None = None,
    ) -> None:
        payload: dict = {
            "status": status,
            "offers_found": offers_found,
            "ended_at": _now(),
        }
        if error_message:
            payload["error_message"] = error_message[:2000]
        self.client.table("scrape_runs").update(payload).eq("id", run_id).execute()

    # ── Candidate insertion ──────────────────────────────────────────────

    def insert_candidate(
        self,
        offer: ScrapedOffer,
        run_id: str,
        source_id: str | None,
    ) -> bool:
        """
        Insert a scraped candidate.

        Returns True if inserted (new), False if skipped (duplicate hash).
        The UNIQUE constraint on candidate_hash prevents double-inserts.
        """
        payload = {
            "scrape_run_id": run_id,
            "scrape_source_id": source_id,
            "title": offer.title,
            "description": offer.description,
            "raw_text": offer.raw_text,
            "source_url": offer.source_url,
            "detected_merchant": offer.detected_merchant,
            "detected_discount": offer.detected_discount,
            "detected_valid_from": (
                offer.detected_valid_from.isoformat()
                if offer.detected_valid_from
                else None
            ),
            "detected_valid_to": (
                offer.detected_valid_to.isoformat()
                if offer.detected_valid_to
                else None
            ),
            "confidence_score": round(float(offer.confidence_score), 2),
            "candidate_hash": offer.candidate_hash,
            "status": "pending",
        }

        try:
            self.client.table("scraped_offer_candidates").insert(payload).execute()
            return True
        except Exception as exc:
            err_str = str(exc).lower()
            if "duplicate key" in err_str or "unique" in err_str or "23505" in err_str:
                logger.debug("Duplicate candidate skipped (hash=%s)", offer.candidate_hash[:12])
                return False
            raise


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
