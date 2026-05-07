"""Text cleaning and normalization utilities."""
import re
import unicodedata


def clean_text(text: str) -> str:
    """Normalize whitespace and remove invisible characters."""
    # Normalize unicode (e.g. non-breaking spaces, zero-width chars)
    text = unicodedata.normalize("NFKD", text)
    # Remove zero-width and control characters
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f​-‏﻿]", "", text)
    # Collapse multiple whitespace (including \n, \t) into a single space
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_for_hash(text: str) -> str:
    """Aggressive normalization for deduplication hashing."""
    text = clean_text(text)
    text = text.lower()
    # Remove punctuation except alphanumeric and spaces
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def truncate(text: str, max_chars: int = 2000) -> str:
    """Truncate text to max_chars, appending ellipsis if cut."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "…"


def is_meaningful(text: str, min_words: int = 5) -> bool:
    """Return True if the text has at least min_words words."""
    return len(text.split()) >= min_words
