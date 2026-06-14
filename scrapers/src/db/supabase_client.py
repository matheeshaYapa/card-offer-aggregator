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
from src.utils.slugify import slugify, unique_suffix

logger = get_logger(__name__)

# Candidates at or above this confidence are auto-published as live offers.
AUTO_PUBLISH_THRESHOLD = 0.8


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
        source: dict | None = None,
    ) -> tuple[bool, bool]:
        """
        Insert a scraped candidate.

        Returns (inserted, auto_published). `inserted` is False if skipped
        (duplicate hash) — the UNIQUE constraint on candidate_hash prevents
        double-inserts. `auto_published` is True if the candidate scored
        >= AUTO_PUBLISH_THRESHOLD and was immediately published as a live offer.
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
            result = self.client.table("scraped_offer_candidates").insert(payload).execute()
        except Exception as exc:
            err_str = str(exc).lower()
            if "duplicate key" in err_str or "unique" in err_str or "23505" in err_str:
                logger.debug("Duplicate candidate skipped (hash=%s)", offer.candidate_hash[:12])
                return False, False
            raise

        candidate_id = result.data[0]["id"]

        auto_published = False
        if offer.confidence_score >= AUTO_PUBLISH_THRESHOLD and offer.title:
            try:
                self._auto_publish(candidate_id, offer, source or {})
                auto_published = True
            except Exception as exc:
                logger.error(
                    "Auto-publish failed for candidate %s: %s", candidate_id, exc, exc_info=True
                )

        return True, auto_published

    def _auto_publish(self, candidate_id: str, offer: ScrapedOffer, source: dict) -> None:
        """Create a live, approved offer from a high-confidence candidate."""
        slug = f"{slugify(offer.title)[:60]}-{unique_suffix()}"
        offer_payload = {
            "country_code": "LK",
            "title": offer.title,
            "slug": slug,
            "description": offer.description,
            "discount_text": offer.detected_discount,
            "merchant_id": None,
            "category_id": None,
            "valid_from": (
                offer.detected_valid_from.isoformat() if offer.detected_valid_from else None
            ),
            "valid_to": (
                offer.detected_valid_to.isoformat() if offer.detected_valid_to else None
            ),
            "source_url": offer.source_url,
            "source_type": "scraped",
            "status": "approved",
            "is_active": True,
            "published_at": _now(),
        }
        result = self.client.table("offers").insert(offer_payload).execute()
        offer_id = result.data[0]["id"]

        bank_id = source.get("bank_id")
        if bank_id:
            self.client.table("offer_bank_rules").insert({
                "offer_id": offer_id,
                "bank_id": bank_id,
                "card_type": None,
                "network": None,
            }).execute()

        self.client.table("scraped_offer_candidates").update({
            "status": "approved",
            "offer_id": offer_id,
        }).eq("id", candidate_id).execute()

        logger.info(
            "  ✓ Auto-published '%s' as live offer (slug=%s, confidence=%.2f)",
            offer.title, slug, offer.confidence_score,
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
