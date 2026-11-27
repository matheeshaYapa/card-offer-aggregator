"""Pydantic model for a scraped offer candidate."""
from datetime import date
from pydantic import BaseModel, Field


class ScrapedOffer(BaseModel):
    title: str | None = None
    description: str | None = None
    raw_text: str
    source_url: str
    detected_merchant: str | None = None
    detected_discount: str | None = None
    detected_valid_from: date | None = None
    detected_valid_to: date | None = None
    # Final score after src/confidence.py (before that: the parser's own score).
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    candidate_hash: str
    # Filled by src/confidence.assess_batch()
    parser_score: float | None = Field(default=None, ge=0.0, le=1.0)
    quality_flags: list[str] = Field(default_factory=list)
    detected_category: str | None = None  # category slug
    category_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
