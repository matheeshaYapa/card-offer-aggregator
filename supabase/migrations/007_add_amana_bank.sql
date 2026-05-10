-- ============================================================
-- CardPromo LK — Migration 007
-- Add Amana Bank (Visa Debit Card offers only — no credit cards)
-- ============================================================

INSERT INTO public.banks (country_code, name, slug, short_name, website_url, is_active)
VALUES (
    'LK',
    'Amana Bank PLC',
    'amana-bank',
    'Amana',
    'https://www.amanabank.lk',
    true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.scrape_sources (bank_id, name, source_url, source_type, is_active)
SELECT
    b.id,
    'Amana Bank Visa Debit Card Offers',
    'https://www.amanabank.lk/personal/services/visa-debit-card/offers/',
    'html',
    true
FROM public.banks b
WHERE b.slug = 'amana-bank'
ON CONFLICT DO NOTHING;
