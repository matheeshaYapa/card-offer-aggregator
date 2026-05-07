"""
Date extractor for Sri Lankan bank promotion text.

Handles patterns like:
  Valid till 30 June 2026
  Valid until 30/06/2026
  Valid from 01 April 2026 to 30 June 2026
  Ends on 2026-06-30
  Offer valid until 31st December 2026
"""
import re
from datetime import date
from dateutil import parser as dateutil_parser

# Month names for regex patterns
_MONTHS = (
    r"(?:January|February|March|April|May|June|July|August|September|"
    r"October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
)
_ORD = r"(?:st|nd|rd|th)?"

# (pattern, group_for_from, group_for_to)
# group = None means no match for that field
DATE_PATTERNS: list[tuple[str, int | None, int | None]] = [
    # "from 01 April 2026 to 30 June 2026"
    (
        rf"from\s+(\d{{1,2}}{_ORD}\s+{_MONTHS}\s+\d{{4}})\s+to\s+(\d{{1,2}}{_ORD}\s+{_MONTHS}\s+\d{{4}})",
        1, 2,
    ),
    # "01 April 2026 to 30 June 2026"
    (
        rf"(\d{{1,2}}{_ORD}\s+{_MONTHS}\s+\d{{4}})\s+(?:to|-)\s+(\d{{1,2}}{_ORD}\s+{_MONTHS}\s+\d{{4}})",
        1, 2,
    ),
    # "valid till/until/through 30 June 2026"
    (
        rf"valid\s+(?:till|until|through|up\s+to)\s+(\d{{1,2}}{_ORD}\s+{_MONTHS}\s+\d{{4}})",
        None, 1,
    ),
    # "valid till/until 30/06/2026"
    (
        r"valid\s+(?:till|until|through)\s+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
        None, 1,
    ),
    # "ends on / expires on 2026-06-30"
    (
        r"(?:ends?\s+on|expires?\s+on|expiry[:\s]+)\s*(\d{4}-\d{2}-\d{2})",
        None, 1,
    ),
    # "ends on 30 June 2026"
    (
        rf"(?:ends?\s+on|expires?\s+on)\s+(\d{{1,2}}{_ORD}\s+{_MONTHS}\s+\d{{4}})",
        None, 1,
    ),
    # Bare ISO date "2026-06-30"
    (
        r"\b(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b",
        None, 1,
    ),
]


def _parse_date(text: str) -> date | None:
    """Try to parse a date string, returning None on failure."""
    if not text:
        return None
    text = re.sub(r"(?:st|nd|rd|th)\b", "", text).strip()
    try:
        return dateutil_parser.parse(text, dayfirst=True).date()
    except Exception:
        return None


def extract_dates(text: str) -> dict[str, date | None]:
    """
    Search text for validity dates.
    Returns {"valid_from": date|None, "valid_to": date|None}.
    """
    text_lower = text.lower()
    result: dict[str, date | None] = {"valid_from": None, "valid_to": None}

    for pattern, from_group, to_group in DATE_PATTERNS:
        m = re.search(pattern, text_lower, re.IGNORECASE)
        if not m:
            continue

        if from_group is not None:
            d = _parse_date(m.group(from_group))
            if d and result["valid_from"] is None:
                result["valid_from"] = d

        if to_group is not None:
            d = _parse_date(m.group(to_group))
            if d and result["valid_to"] is None:
                result["valid_to"] = d

        # Stop at first useful match
        if result["valid_to"]:
            break

    return result
