-- ============================================================
-- CardPromo LK — Migration 004
-- Add scrape sources for Bank of Ceylon (BOC) and People's Bank
-- ============================================================
-- Prerequisites: migration 003_seed_base_data.sql must be run first
-- (it seeds the banks rows for 'boc' and 'peoples-bank').

-- BOC Card Offers
-- All ~50 offers across Travel, Supermarkets, Dining, Health, etc.
-- are listed on a single server-rendered HTML page.
INSERT INTO public.scrape_sources (bank_id, name, source_url, source_type, is_active)
SELECT
    b.id,
    'BOC Card Offers',
    'https://www.boc.lk/personal-banking/card-offers',
    'html',
    true
FROM public.banks b
WHERE b.slug = 'boc'
ON CONFLICT DO NOTHING;

-- People's Bank Special Offers
-- Category-based structure; the scraper iterates all category sub-pages.
-- This source URL is the main hub page.
INSERT INTO public.scrape_sources (bank_id, name, source_url, source_type, is_active)
SELECT
    b.id,
    'Peoples Bank Special Offers',
    'https://www.peoplesbank.lk/special-offers/',
    'html',
    true
FROM public.banks b
WHERE b.slug = 'peoples-bank'
ON CONFLICT DO NOTHING;
