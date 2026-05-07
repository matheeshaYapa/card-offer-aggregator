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
    confidence_score: float = Field(default=0.0, ge=0.0, le=1.0)
    candidate_hash: str
