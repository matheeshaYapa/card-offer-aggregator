-- ============================================================
-- CardPromo LK — Migration 005
-- Add Seylan Bank and its scrape source
-- ============================================================

-- ── 1. Add Seylan Bank to banks table ────────────────────────────────────────
INSERT INTO public.banks (country_code, name, slug, short_name, website_url, is_active)
VALUES (
    'LK',
    'Seylan Bank PLC',
    'seylan-bank',
    'Seylan',
    'https://www.seylan.lk',
    true
)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Add scrape source ─────────────────────────────────────────────────────
INSERT INTO public.scrape_sources (bank_id, name, source_url, source_type, is_active)
SELECT
    b.id,
    'Seylan Bank Card Promotions',
    'https://www.seylan.lk/promotions/cards',
    'html',
    true
FROM public.banks b
WHERE b.slug = 'seylan-bank'
ON CONFLICT DO NOTHING;
