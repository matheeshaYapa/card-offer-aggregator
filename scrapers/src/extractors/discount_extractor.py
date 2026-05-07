"""
Discount text extractor for Sri Lankan bank promotion text.

Detects patterns like:
  20% off / up to 50% discount
  Rs. 1,000 off / LKR 500 discount
  Buy 1 Get 1 Free / BOGO
  0% installment / 0% interest
  Cashback offers
"""
import re


# (pattern flags, regex, canonical_format)
# canonical_format is a callable that receives the match and returns a string
_PATTERNS: list[tuple[int, str, callable]] = [
    # "up to X% off/discount/savings"
    (re.IGNORECASE, r"up\s+to\s+(\d+)\s*%\s*(?:off|discount|saving|cashback)?",
     lambda m: f"Up to {m.group(1)}% off"),
    # "X% off / X% discount / X% cashback"
    (re.IGNORECASE, r"(\d+)\s*%\s*(?:off|discount|saving|cashback)",
     lambda m: f"{m.group(1)}% off"),
    # "Rs./LKR X,XXX off/discount"
    (re.IGNORECASE, r"(?:Rs\.?|LKR)\s*([\d,]+)\s*(?:off|discount|saving)",
     lambda m: f"Rs. {m.group(1)} off"),
    # "Buy 1 Get 1 Free / BOGO / B1G1"
    (re.IGNORECASE, r"(?:buy\s+1\s+get\s+1|bogo|b1g1)(?:\s+free)?",
     lambda _: "Buy 1 Get 1 Free"),
    # "0% installment / 0% interest"
    (re.IGNORECASE, r"0\s*%\s*(?:installment|interest|finance)",
     lambda _: "0% installment"),
    # "X months 0% installment"
    (re.IGNORECASE, r"(\d+)\s+months?\s+0\s*%\s*(?:installment|interest)?",
     lambda m: f"0% installment for {m.group(1)} months"),
    # "free delivery / free shipping"
    (re.IGNORECASE, r"free\s+(?:delivery|shipping)",
     lambda _: "Free delivery"),
    # "cashback" (generic)
    (re.IGNORECASE, r"(\d+)\s*%\s*cashback",
     lambda m: f"{m.group(1)}% cashback"),
    (re.IGNORECASE, r"cashback",
     lambda _: "Cashback offer"),
]


def extract_discount(text: str) -> str | None:
    """
    Return the most specific discount string found in text, or None.
    More specific patterns are listed first and take priority.
    """
    for flags, pattern, formatter in _PATTERNS:
        m = re.search(pattern, text, flags)
        if m:
            return formatter(m)
    return None
