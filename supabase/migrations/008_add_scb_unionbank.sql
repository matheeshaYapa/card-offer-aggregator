-- ============================================================
-- CardPromo LK — Migration 008
-- Add Standard Chartered Bank and Union Bank
-- ============================================================

-- ── Standard Chartered Bank ───────────────────────────────────────────────────
INSERT INTO public.banks (country_code, name, slug, short_name, website_url, is_active)
VALUES (
    'LK',
    'Standard Chartered Bank',
    'standard-chartered',
    'SCB',
    'https://www.sc.com/lk',
    true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scrape_sources (bank_id, name, source_url, source_type, is_active)
SELECT
    b.id,
    'SCB Good Life Privileges',
    'https://www.sc.com/lk/promotions/the-good-life-privileges/',
    'html',
    true
FROM public.banks b
WHERE b.slug = 'standard-chartered'
ON CONFLICT DO NOTHING;

-- ── Union Bank ────────────────────────────────────────────────────────────────
INSERT INTO public.banks (country_code, name, slug, short_name, website_url, is_active)
VALUES (
    'LK',
    'Union Bank of Colombo PLC',
    'union-bank',
    'UB',
    'https://www.unionb.com',
    true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scrape_sources (bank_id, name, source_url, source_type, is_active)
SELECT
    b.id,
    'Union Bank Credit Card Offers',
    'https://www.unionb.com/credit-cards-offers/',
    'html',
    true
FROM public.banks b
WHERE b.slug = 'union-bank'
ON CONFLICT DO NOTHING;
