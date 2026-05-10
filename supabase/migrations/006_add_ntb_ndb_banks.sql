-- ============================================================
-- CardPromo LK — Migration 006
-- Add Nations Trust Bank (NTB) and NDB Bank
-- ============================================================

-- ── 1. Nations Trust Bank ─────────────────────────────────────────────────────
INSERT INTO public.banks (country_code, name, slug, short_name, website_url, is_active)
VALUES (
    'LK',
    'Nations Trust Bank PLC',
    'nations-trust-bank',
    'NTB',
    'https://www.nationstrust.com',
    true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scrape_sources (bank_id, name, source_url, source_type, is_active)
SELECT
    b.id,
    'NTB Card Promotions',
    'https://www.nationstrust.com/promotions/what-s-new',
    'html',
    true
FROM public.banks b
WHERE b.slug = 'nations-trust-bank'
ON CONFLICT DO NOTHING;

-- ── 2. NDB Bank ───────────────────────────────────────────────────────────────
INSERT INTO public.banks (country_code, name, slug, short_name, website_url, is_active)
VALUES (
    'LK',
    'NDB Bank PLC',
    'ndb-bank',
    'NDB',
    'https://www.ndbbank.com',
    true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scrape_sources (bank_id, name, source_url, source_type, is_active)
SELECT
    b.id,
    'NDB Card Offers',
    'https://www.ndbbank.com/cards/card-offers',
    'html',
    true
FROM public.banks b
WHERE b.slug = 'ndb-bank'
ON CONFLICT DO NOTHING;
