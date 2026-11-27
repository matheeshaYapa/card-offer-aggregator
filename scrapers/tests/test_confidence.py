from datetime import date, timedelta

from src.confidence import assess_batch, benefit_supported, offer_flags
from src.models.scraped_offer import ScrapedOffer
from src.scrape_quality import auto_publish_blockers

TODAY = date(2026, 11, 27)
SOURCE = {"bank_slug": "sampath-bank", "source_url": "https://www.sampath.lk/sampath-cards/credit-card-offer"}


def make(title="Nagoya Japanese Restaurant", discount="20% off", description=None, score=1.0, **extra) -> ScrapedOffer:
    description = description if description is not None else f"{discount} on dine in at {title}"
    return ScrapedOffer(
        title=title, description=description, raw_text=f"{title} | {description}",
        source_url="https://www.sampath.lk/promo/" + title.lower().replace(" ", "-"),
        detected_merchant=title, detected_discount=discount,
        detected_valid_from=TODAY, detected_valid_to=TODAY + timedelta(days=60),
        confidence_score=score, candidate_hash=title + discount, **extra,
    )


def test_clean_offer_keeps_score_and_publishes():
    [offer], report = assess_batch([make()], TODAY)
    assert offer.quality_flags == []
    assert offer.confidence_score == 1.0
    assert offer.detected_category == "dining"
    assert offer.parser_score == 1.0
    assert not report.anomaly
    assert auto_publish_blockers(offer, SOURCE) == []


def test_generic_and_placeholder_titles_are_hard_blocked():
    for title, flag in [("Visa Global Offers", "generic_title"), ("Merchant Name", "placeholder_title"),
                        ("Exclusive Offers for Sampath Visa Cardholders", "generic_title")]:
        [offer], _ = assess_batch([make(title=title)], TODAY)
        assert flag in offer.quality_flags, title
        assert any(flag in b for b in auto_publish_blockers(offer, SOURCE))


def test_benefit_must_match_text():
    assert benefit_supported("25% off", "Enjoy 25% savings")
    assert benefit_supported("Up to 20% off", "no figures here")  # no evidence either way
    assert not benefit_supported("50% off", "Enjoy 15% off for credit cards")
    assert benefit_supported("Rs. 1,000 off", "Save LKR 1000 on bills")
    assert not benefit_supported("Rs. 5,000 off", "Save LKR 1,000 on bills")


def test_vague_and_implausible_benefits():
    assert "vague_benefit" in offer_flags(make(discount="Special offer", description="Visit us"), TODAY)
    assert "vague_benefit" not in offer_flags(make(discount="0% installment"), TODAY)
    assert "implausible_benefit" in offer_flags(make(discount="95% off"), TODAY)
    assert "implausible_benefit" not in offer_flags(make(discount="100% cashback"), TODAY)


def test_far_future_end_date():
    offer = make()
    offer = offer.model_copy(update={"detected_valid_to": date(2028, 9, 30)})
    [scored], _ = assess_batch([offer], TODAY)
    assert "far_future_end" in scored.quality_flags
    assert scored.confidence_score < 0.85


def test_joined_words_flagged():
    flags = offer_flags(make(title="ITC RatnadeepaIndian Ocean PavilionPeshawriThe Islander"), TODAY)
    assert "joined_words" in flags
    assert "joined_words" not in offer_flags(make(title="Enjoy exclusive savings on PickMe Food with ComBank VISA"), TODAY)


def test_shared_title_across_different_offers_goes_to_review():
    offers = [
        make(title="Up to 35% Savings on Reservations", discount="Up to 35% off",
             description=f"Booking & stay at hotel {i}").model_copy(update={
                 "source_url": f"https://www.ndbbank.com/cards/offer-{i}", "detected_merchant": None})
        for i in range(3)
    ]
    scored, _ = assess_batch(offers, TODAY)
    assert all("duplicate_title" in o.quality_flags for o in scored)
    assert all(o.confidence_score < 0.80 for o in scored)


def test_boilerplate_description_removed_not_penalised():
    blurb = "Get the best deals for a range of products and services with BOC credit card offers."
    offers = [make(title=f"Hotel {name}", discount="20% off", description=blurb + " 20% off")
              for name in ("Alpha", "Bravo", "Charlie", "Delta")]
    scored, _ = assess_batch(offers, TODAY)
    assert all(o.description is None for o in scored)
    assert all("boilerplate_description" in o.quality_flags for o in scored)
    assert all(o.confidence_score == 1.0 for o in scored)


def test_batch_anomaly_holds_whole_source():
    offers = [make(title="Special Offers", discount=f"{10 + i}% off") for i in range(6)]
    scored, report = assess_batch(offers, TODAY)
    assert report.anomaly
    assert all("batch_anomaly" in o.quality_flags for o in scored)


def test_parser_score_is_preserved_on_rescore():
    [once], _ = assess_batch([make(score=0.9)], TODAY)
    [twice], _ = assess_batch([once], TODAY)
    assert twice.parser_score == 0.9
    assert twice.confidence_score == once.confidence_score
