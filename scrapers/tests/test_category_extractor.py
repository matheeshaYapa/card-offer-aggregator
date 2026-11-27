import pytest

from src.extractors.category_extractor import classify, classify_label, detect_category

# Real offer titles/descriptions seen on card-promo.com (Nov 2026).
CASES = [
    ("20% off on BB, HB and FB basis at Lotus Estate Colombo", None, None, "travel"),
    ("Era Beach (Thalpe)", "(BB, HB & FB)", None, "travel"),
    ("The River House, Dambulla", "Book a minimum of 02 nights and enjoy 35% savings", None, "travel"),
    ("Swiss-belHotel International", "20% off at participating hotels with min. 2 nights stay", None, "travel"),
    ("Explore Malaysia with Visa Offers !", None, None, "travel"),
    ("FindMyFare", "Up to 10% off with Mastercard Credit & Debit Cards", None, "travel"),
    ("Galle Face Hotel1864 Limited EditionIn...on the Green", "Enjoy 20% off with Mastercard Credit Cards", None, "travel"),
    ("Nagoya Japanese Restaurant", "Offer 1: 20% OFF on Dine in & Take away at Nagoya", None, "dining"),
    ("Best Western Elyon Colombo - VU Rooftop Bar", "Minimum bill value of Rs.25,000/-", None, "dining"),
    ("Enjoy the art of dining in Indonesia with ComBank Visa Cards", None, None, "dining"),
    ("KFC", "Enjoy 30% off with Mastercard Credit Card", None, "dining"),
    ("Keells Supermarket", "25% Discount on Fresh Vegetables, Fruits & Seafood", None, "supermarket"),
    ("Enjoy the best supermarket fresh deals at Softlogic Glomark", None, None, "supermarket"),
    ("DAMRO INSTALLMENT PLANS", "0% , UPTO 24 MONTHS INSTALLMENT PLANS", None, "electronics"),
    ("www.buyabans.com", "Up to 20 months 0% interest instalment plans", None, "electronics"),
    ("Purchase your favourite outfit at Spring and Summer", None, None, "shopping"),
    ("Diamond Dreams", "Up to 40% off + 0% Instalment Plans", None, "shopping"),
    ("Great online deals at Daraz with ComBank Credit Cards", None, None, "online"),
    ("Durdans Hospital", "Lab Investigations Including All Laboratories Discount: 20%", None, "healthcare"),
    ("Footrub", "Enjoy 20% savings on all services", None, "lifestyle"),
    ("Fuel your journey with savings on Mobil Engine Oil", None, None, "automotive"),
    ("Siyalga Enterprises", "Enjoy upto 40% off for Brand New Tyres only", None, "automotive"),
    ("BMS CAMPUS", "0% Instalment plans for 12M with your Seylan Credit Card", None, "education"),
    ("Enjoy a 10% Cashback for Utility Bill payments via Q+ Payment App", None, None, "services"),
]


@pytest.mark.parametrize("title,description,merchant,expected", CASES)
def test_real_offers(title, description, merchant, expected):
    slug, confidence = detect_category(title, description, merchant)
    assert slug == expected, (title, slug, confidence)


def test_bill_value_is_not_a_bill_payment():
    # "Maximum Bill Value" appears on restaurant offers; it must not pull them into services.
    slug, _ = detect_category("Thai Rasa at NH Collection Colombo", "Maximum Bill Value Rs.50,000/- For Lunch & Dinner")
    assert slug == "dining"


def test_bank_label_wins():
    result = classify("Something vague", raw_text="Something vague | Category: Super Markets | 10% off")
    assert (result.slug, result.source) == ("supermarket", "label")


@pytest.mark.parametrize("label,expected", [
    ("Dining", "dining"), ("hotels", "travel"), ("super_markets", "supermarket"),
    ("Electronics_and_Furniture", "electronics"), ("health_and_insurance", "healthcare"),
    ("fashion", "shopping"), ("travel_and_leisure", "travel"), ("Online", "online"),
    ("Premium_Offers", None), ("VISA_Offers", None), ("Other", None), (None, None),
])
def test_label_mapping(label, expected):
    assert classify_label(label) == expected


@pytest.mark.parametrize("title", [
    "Treat yourself with amazing ComBank Visa Card Offers",
    "Up to 36 months 0% installment plans",
    "Merchant Name",
])
def test_no_evidence_stays_uncategorised(title):
    assert detect_category(title)[0] is None
