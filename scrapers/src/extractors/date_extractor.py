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
    text = re.sub(r"(?<=\d)(?:st|nd|rd|th)\b", "", text, flags=re.IGNORECASE).strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            return date.fromisoformat(text)
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


def extract_schedule(text: str) -> dict[str, date | None]:
    """Parse a dedicated validity field while preserving gaps in the schedule."""
    text = " ".join(text.split()).replace("–", "to").replace("—", "to")
    empty = {"valid_from": None, "valid_to": None}
    day = rf"\d{{1,2}}{_ORD}"
    month_year = rf"{_MONTHS} 20\d{{2}}"
    date_with_year = rf"{day} {month_year}"

    single = re.fullmatch(rf"(?:valid on )?({date_with_year})", text, re.I)
    if single:
        parsed = _parse_date(single[1])
        return {"valid_from": parsed, "valid_to": parsed}

    consecutive = re.fullmatch(rf"(?:valid on )?({day})\s*&\s*({day}) ({month_year})", text, re.I)
    if consecutive:
        first, last, end_month = consecutive.groups()
        start, end = _parse_date(f"{first} {end_month}"), _parse_date(f"{last} {end_month}")
        if start and end and (end - start).days == 1:
            return {"valid_from": start, "valid_to": end}
        return empty

    if re.search(r"[,;&]|\band\b", text, re.I):
        return empty
    shared_year = re.fullmatch(
        rf"(?:valid (?:from )?)?({day} {_MONTHS})\s+to\s+({day} {_MONTHS}) (20\d{{2}})", text, re.I,
    )
    if shared_year:
        first, last, year = shared_year.groups()
        return extract_dates(f"{first} {year} to {last} {year}")
    shared_month = re.fullmatch(
        rf"(?:valid (?:from )?)?({day})\s+to\s+({day}) ({month_year})", text, re.I,
    )
    if shared_month:
        first, last, month = shared_month.groups()
        return extract_dates(f"{first} {month} to {last} {month}")
    return extract_dates(text)
