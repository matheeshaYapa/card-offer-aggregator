"""Slug generation helpers — Python port of apps/web/src/utils/slugUtils.ts."""
import re
import time
import uuid


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text, flags=re.ASCII)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


def unique_suffix() -> str:
    """Mirrors the suffix logic in candidates.ts bulkApproveAsOffers (timestamp + random)."""
    return f"{int(time.time() * 1000):x}{uuid.uuid4().hex[:5]}"
