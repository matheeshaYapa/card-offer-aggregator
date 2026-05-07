"""Stable SHA-256 candidate hash generation."""
import hashlib
from src.utils.text_cleaner import normalize_for_hash


def generate_candidate_hash(
    source_url: str,
    title: str | None,
    discount: str | None,
    valid_to: str | None,
    raw_text: str | None = None,
) -> str:
    """
    Produce a stable, deduplication hash for a scraped offer candidate.

    Components (concatenated with '|'):
      - source_url          — the page the offer was scraped from
      - normalized title    — if missing, uses first 150 chars of raw_text
      - normalized discount — or empty string
      - valid_to            — ISO date string or empty string

    SHA-256 hex digest of the joined components is returned.
    """
    title_part = normalize_for_hash(title or "")
    if not title_part and raw_text:
        title_part = normalize_for_hash(raw_text[:150])

    components = "|".join([
        source_url.strip().rstrip("/"),
        title_part,
        normalize_for_hash(discount or ""),
        (valid_to or "").strip(),
    ])
    return hashlib.sha256(components.encode("utf-8")).hexdigest()
