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
from src.scrape_quality import auto_publish_blockers
from src.utils.logger import get_logger
from src.utils.slugify import slugify

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

    # Columns added by migration 010. If the migration hasn't been applied yet,
    # inserts retry without them so scraping keeps working.
    QUALITY_COLUMNS = ("parser_score", "quality_flags", "detected_category_id", "category_confidence")

    def __init__(self) -> None:
        self.client = get_supabase_client()
        self._category_ids: dict[str, str] | None = None
        self._quality_columns = True

    # ── Lookups ──────────────────────────────────────────────────────────

    def category_id(self, slug: str | None) -> str | None:
        if not slug:
            return None
        if self._category_ids is None:
            rows = self.client.table("categories").select("id, slug").eq("is_active", True).execute().data or []
            self._category_ids = {row["slug"]: row["id"] for row in rows}
            missing = {"automotive", "education", "services"} - set(self._category_ids)
            if missing:
                logger.warning("Categories %s missing — apply migration 010", ", ".join(sorted(missing)))
        return self._category_ids.get(slug)

    def last_successful_count(self, source_id: str | None) -> int | None:
        """offers_found of this source's most recent successful run (for drift detection)."""
        if not source_id:
            return None
        rows = (
            self.client.table("scrape_runs").select("offers_found")
            .eq("scrape_source_id", source_id).eq("status", "success")
            .order("started_at", desc=True).limit(1).execute().data
        )
        return rows[0]["offers_found"] if rows else None

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
        source: dict | None = None,
    ) -> tuple[bool, bool]:
        """
        Insert a scraped candidate.

        Returns (inserted, auto_published). `inserted` is False if skipped
        (duplicate hash) — the UNIQUE constraint on candidate_hash prevents
        double-inserts. Publication requires evidence checks and an atomic
        database transaction that also writes the eligibility rule.
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
        quality = {
            "parser_score": None if offer.parser_score is None else round(float(offer.parser_score), 2),
            "quality_flags": offer.quality_flags,
            "detected_category_id": self.category_id(offer.detected_category),
            "category_confidence": offer.category_confidence,
        }

        result = self._upsert_candidate(payload, quality)
        inserted = bool(result.data)
        if not inserted and self._quality_columns:
            # Re-seen offer: keep the stored score current with today's checks.
            (
                self.client.table("scraped_offer_candidates")
                .update({"confidence_score": payload["confidence_score"], **quality})
                .eq("candidate_hash", offer.candidate_hash).eq("status", "pending")
                .execute()
            )
        blockers = auto_publish_blockers(offer, source or {})
        if blockers or not source_id:
            logger.debug("Review %s: %s", offer.candidate_hash[:12], ", ".join(blockers))
            return inserted, False

        if inserted:
            candidate_id = result.data[0]["id"]
        else:
            pending = (
                self.client.table("scraped_offer_candidates")
                .select("id")
                .eq("candidate_hash", offer.candidate_hash)
                .eq("scrape_source_id", source_id)
                .eq("status", "pending")
                .is_("offer_id", "null")
                .maybe_single()
                .execute()
            )
            if not pending or not pending.data:
                return False, False
            candidate_id = pending.data["id"]

        slug = f"{slugify(offer.title or 'promotion')[:60].rstrip('-') or 'promotion'}-{candidate_id.replace('-', '')}"
        published = self.client.rpc("publish_scraped_candidate", {
            "candidate_id": candidate_id,
            "offer_slug": slug,
        }).execute().data
        if published:
            logger.info("  Published %s (confidence %.2f)", slug, offer.confidence_score)
        return inserted, bool(published)

    def _upsert_candidate(self, payload: dict, quality: dict):
        table = self.client.table("scraped_offer_candidates")
        if self._quality_columns:
            try:
                return table.upsert({**payload, **quality}, on_conflict="candidate_hash", ignore_duplicates=True).execute()
            except Exception as exc:  # PostgREST PGRST204: column not in schema cache
                if "PGRST204" not in str(exc) and not any(col in str(exc) for col in self.QUALITY_COLUMNS):
                    raise
                self._quality_columns = False
                logger.warning("Quality columns missing — apply migration 010. Saving candidates without them.")
        return table.upsert(payload, on_conflict="candidate_hash", ignore_duplicates=True).execute()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
