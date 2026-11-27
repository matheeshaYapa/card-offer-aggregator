import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from src.models.scraped_offer import ScrapedOffer

AUTO_PUBLISH_THRESHOLD = 0.80
SRI_LANKA_TIME = timezone(timedelta(hours=5, minutes=30))

# Only banks with dedicated parsers qualify. Check both the source and the
# extracted offer URL, including candidates from banks with public JSON feeds.
BANK_HOSTS = {
    "amana-bank": "amanabank.lk",
    "boc": "boc.lk",
    "commercial-bank": "combank.lk",
    "dfcc-bank": "dfcc.lk",
    "hnb": "hnb.lk",
    "nations-trust-bank": "nationstrust.com",
    "ndb-bank": "ndbbank.com",
    "peoples-bank": "peoplesbank.lk",
    "sampath-bank": "sampath.lk",
    "seylan-bank": "seylan.lk",
    "union-bank": "unionb.com",
}

_BAD_TITLE = re.compile(
    r'\{\{|\}\}|["\'}]>|<[^>]*>|^\s*(?:special offers|read more|learn more|credit card offers)\s*$',
    re.I,
)


def local_today():
    return datetime.now(SRI_LANKA_TIME).date()


def auto_publish_blockers(offer: ScrapedOffer, source: dict) -> list[str]:
    blockers = []
    if offer.confidence_score < AUTO_PUBLISH_THRESHOLD:
        blockers.append("low parser score")
    if not offer.title or _BAD_TITLE.search(offer.title):
        blockers.append("missing or malformed title")
    if not offer.detected_discount or not offer.detected_discount.strip():
        blockers.append("missing benefit")
    if not offer.detected_valid_to:
        blockers.append("missing end date")
    elif offer.detected_valid_to < local_today():
        blockers.append("expired")
    elif offer.detected_valid_from and offer.detected_valid_from > offer.detected_valid_to:
        blockers.append("invalid date range")

    expected_host = BANK_HOSTS.get(source.get("bank_slug"))
    if not expected_host or not all(
        _is_bank_url(url, expected_host) for url in (source.get("source_url"), offer.source_url)
    ):
        blockers.append("unverified issuer URL")
    return blockers


def _is_bank_url(value: str | None, expected_host: str) -> bool:
    try:
        url = urlsplit(value or "")
        return (
            url.scheme == "https"
            and url.hostname in {expected_host, f"www.{expected_host}"}
            and url.username is None
            and url.port in {None, 443}
        )
    except ValueError:
        return False
