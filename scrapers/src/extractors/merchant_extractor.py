"""
Merchant name extractor.

Uses a keyword list of known Sri Lankan merchants and falls back to
extracting the most prominent noun phrase from the offer title.
"""
import re

# Known merchant keywords → canonical name
KNOWN_MERCHANTS: dict[str, str] = {
    "keells": "Keells Super",
    "keels": "Keells Super",
    "cargills": "Cargills Food City",
    "food city": "Cargills Food City",
    "arpico": "Arpico Super Centre",
    "laugfs": "Laugfs Supermarket",
    "sathosa": "Sathosa",
    "abans": "Abans",
    "singer": "Singer Sri Lanka",
    "softlogic": "Softlogic",
    "dialog": "Dialog",
    "mobitel": "Mobitel",
    "slt": "SLT",
    "airtel": "Airtel",
    "mcdonalds": "McDonald's",
    "pizza hut": "Pizza Hut",
    "kfc": "KFC",
    "burger king": "Burger King",
    "domino": "Domino's",
    "cinnamon": "Cinnamon Hotels & Resorts",
    "jetwing": "Jetwing Hotels",
    "heritance": "Heritance Hotels",
    "odel": "Odel",
    "paradise road": "Paradise Road",
    "nolimit": "No Limit",
    "no limit": "No Limit",
    "cotton collection": "Cotton Collection",
    "spa ceylon": "Spa Ceylon",
}


def extract_merchant(text: str) -> str | None:
    """
    Search text for known merchant keywords and return canonical name.
    Returns None if no known merchant is found.
    """
    text_lower = text.lower()
    for keyword, canonical in KNOWN_MERCHANTS.items():
        if keyword in text_lower:
            return canonical
    return None


def extract_merchant_from_title(title: str | None) -> str | None:
    """
    Try to extract a merchant name from an offer title using heuristics.
    Looks for patterns like "X% off at [Merchant]" or "[Merchant] offers".
    """
    if not title:
        return None

    # "at [Merchant Name]"
    m = re.search(r"\bat\s+([A-Z][A-Za-z\s&']+?)(?:\s+(?:stores?|outlets?|restaurants?|showrooms?|branches?))?$", title)
    if m:
        return m.group(1).strip()

    # First try known merchant lookup on the title
    return extract_merchant(title)
