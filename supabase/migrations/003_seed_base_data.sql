-- ============================================================
-- CardPromo LK — Base Seed Data
-- Migration: 003_seed_base_data.sql
-- ============================================================
-- This seed populates the minimum reference data needed to
-- run the application. Run after 001 and 002.
-- ============================================================

-- ============================================================
-- Country
-- ============================================================
insert into public.countries (code, name, is_active) values
  ('LK', 'Sri Lanka', true)
on conflict (code) do nothing;

-- ============================================================
-- Banks  (5 major Sri Lankan banks)
-- ============================================================
insert into public.banks (country_code, name, slug, short_name, website_url, is_active) values
  ('LK', 'Commercial Bank of Ceylon', 'commercial-bank', 'ComBank',  'https://www.combank.lk',    true),
  ('LK', 'Sampath Bank',              'sampath-bank',    'Sampath',   'https://www.sampath.lk', true),
  ('LK', 'Hatton National Bank',      'hnb',             'HNB',       'https://www.hnb.lk',        true),
  ('LK', 'Bank of Ceylon',            'boc',             'BOC',       'https://www.boc.lk',         true),
  ('LK', 'People''s Bank',            'peoples-bank',    'People''s', 'https://www.peoplesbank.lk', true)
on conflict (slug) do nothing;

-- ============================================================
-- Categories  (5 core categories)
-- ============================================================
insert into public.categories (name, slug, icon, is_active) values
  ('Dining',       'dining',       'UtensilsCrossed', true),
  ('Shopping',     'shopping',     'ShoppingBag',     true),
  ('Travel',       'travel',       'Plane',           true),
  ('Supermarket',  'supermarket',  'ShoppingCart',    true),
  ('Electronics',  'electronics',  'Laptop',          true)
on conflict (slug) do nothing;

-- ============================================================
-- Cards  (2 per bank → 10 total)
-- Uses a subquery to resolve bank UUIDs by slug.
-- ============================================================
insert into public.cards (bank_id, name, slug, card_type, network, tier, is_active)
select b.id, 'Visa Credit Card',       b.slug || '-visa-credit',       'credit', 'visa',       'standard', true from public.banks b where b.slug = 'commercial-bank'
union all
select b.id, 'Mastercard Credit Card', b.slug || '-mastercard-credit', 'credit', 'mastercard', 'standard', true from public.banks b where b.slug = 'commercial-bank'
union all
select b.id, 'Visa Debit Card',        b.slug || '-visa-debit',        'debit',  'visa',       'standard', true from public.banks b where b.slug = 'commercial-bank'
union all
select b.id, 'Mastercard Credit Card', b.slug || '-mastercard-credit', 'credit', 'mastercard', 'standard', true from public.banks b where b.slug = 'sampath-bank'
union all
select b.id, 'Visa Debit Card',        b.slug || '-visa-debit',        'debit',  'visa',       'standard', true from public.banks b where b.slug = 'sampath-bank'
union all
select b.id, 'Visa Credit Card',       b.slug || '-visa-credit',       'credit', 'visa',       'standard', true from public.banks b where b.slug = 'hnb'
union all
select b.id, 'Visa Debit Card',        b.slug || '-visa-debit',        'debit',  'visa',       'standard', true from public.banks b where b.slug = 'hnb'
union all
select b.id, 'Mastercard Credit Card', b.slug || '-mastercard-credit', 'credit', 'mastercard', 'standard', true from public.banks b where b.slug = 'boc'
union all
select b.id, 'Visa Debit Card',        b.slug || '-visa-debit',        'debit',  'visa',       'standard', true from public.banks b where b.slug = 'boc'
union all
select b.id, 'Visa Credit Card',       b.slug || '-visa-credit',       'credit', 'visa',       'standard', true from public.banks b where b.slug = 'peoples-bank'
on conflict (slug) do nothing;

-- ============================================================
-- Merchants  (one per offer category for variety)
-- ============================================================
insert into public.merchants (country_code, name, slug, category_id, is_active)
select 'LK', 'Selected Partner Restaurants', 'selected-restaurants',  c.id, true from public.categories c where c.slug = 'dining'
union all
select 'LK', 'Keells Super',                 'keells-super',           c.id, true from public.categories c where c.slug = 'supermarket'
union all
select 'LK', 'Cinnamon Hotels & Resorts',    'cinnamon-hotels',        c.id, true from public.categories c where c.slug = 'travel'
union all
select 'LK', 'CPC & Lanka IOC',              'cpc-lanka-ioc',          c.id, true from public.categories c where c.slug = 'shopping'
union all
select 'LK', 'Abans',                        'abans',                  c.id, true from public.categories c where c.slug = 'electronics'
union all
select 'LK', 'Selected Hotel Restaurants',   'hotel-restaurants',      c.id, true from public.categories c where c.slug = 'dining'
union all
select 'LK', 'Selected Online Retailers',    'online-retailers',       c.id, true from public.categories c where c.slug = 'shopping'
union all
select 'LK', 'Singer Sri Lanka',             'singer-sri-lanka',       c.id, true from public.categories c where c.slug = 'electronics'
union all
select 'LK', 'Paradise Road',                'paradise-road',          c.id, true from public.categories c where c.slug = 'shopping'
union all
select 'LK', 'Odel',                         'odel',                   c.id, true from public.categories c where c.slug = 'shopping'
union all
select 'LK', 'Cargills Food City',           'cargills-food-city',     c.id, true from public.categories c where c.slug = 'supermarket'
union all
select 'LK', 'Selected Premium Resorts',     'selected-resorts',       c.id, true from public.categories c where c.slug = 'travel'
on conflict (slug) do nothing;

-- ============================================================
-- Scrape Sources (initial set for the scraper pipeline)
-- ============================================================
insert into public.scrape_sources (bank_id, name, source_url, source_type, is_active)
select b.id, 'HNB Credit Card Offers',               'https://www.hnb.lk/card-promotion', 'html', true from public.banks b where b.slug = 'hnb'
union all
select b.id, 'Commercial Bank Credit Card Offers',   'https://www.combank.lk/rewards-promotions',                     'html', true from public.banks b where b.slug = 'commercial-bank'
union all
select b.id, 'Sampath Bank Credit Card Promotions',  'https://www.sampath.lk/sampath-cards/credit-card-offer',                 'html', true from public.banks b where b.slug = 'sampath-bank'
on conflict do nothing;

-- ============================================================
-- Sample Offers  (approved and visible to public)
-- Note: slugs must be unique; offers reference merchant/category by UUID.
-- ============================================================

-- We insert offers one at a time referencing slugs via subquery.
-- All sample offers are status='approved', is_active=true.

insert into public.offers (
  country_code, title, slug, description, discount_text,
  merchant_id, category_id,
  valid_from, valid_to, terms_text,
  source_url, source_type, status, is_active, is_featured
)
select
  'LK',
  '20% Off at Selected Restaurants',
  'combank-20-off-selected-restaurants',
  'Enjoy 20% savings when you dine at selected partner restaurants islandwide using your ComBank Visa or Mastercard credit card.',
  '20% off',
  m.id, c.id,
  '2026-04-01', '2026-06-30',
  'Valid for dine-in only at participating restaurants. Maximum discount of Rs. 2,000 per transaction. Cannot be combined with other offers.',
  'https://www.combank.lk',
  'manual', 'approved', true, true
from public.merchants m, public.categories c
where m.slug = 'selected-restaurants' and c.slug = 'dining'
on conflict (slug) do nothing;

insert into public.offers (
  country_code, title, slug, description, discount_text,
  merchant_id, category_id,
  valid_from, valid_to, terms_text,
  source_url, source_type, status, is_active, is_featured
)
select
  'LK',
  '10% Cashback at Keells Super',
  'sampath-10-cashback-keells-super',
  'Get 10% cashback on grocery purchases at all Keells Super outlets when you pay with any Sampath Bank card.',
  '10% cashback',
  m.id, c.id,
  '2026-04-01', '2026-07-31',
  'Cashback credited within 30 days. Maximum cashback of Rs. 500 per transaction. Valid for a minimum spend of Rs. 3,000.',
  'https://www.sampath.lk',
  'manual', 'approved', true, false
from public.merchants m, public.categories c
where m.slug = 'keells-super' and c.slug = 'supermarket'
on conflict (slug) do nothing;

insert into public.offers (
  country_code, title, slug, description, discount_text,
  merchant_id, category_id,
  valid_from, valid_to, terms_text,
  source_url, source_type, status, is_active, is_featured
)
select
  'LK',
  '15% Off at Cinnamon Hotels & Resorts',
  'hnb-15-off-cinnamon-hotels',
  'Book your stay at any Cinnamon Hotels & Resorts property in Sri Lanka and save 15% when paying with your HNB Visa Credit Card.',
  '15% off',
  m.id, c.id,
  '2026-04-01', '2026-12-31',
  'Valid for direct bookings only. Not valid on public holidays and special events. Advance booking of at least 7 days required.',
  'https://www.hnb.lk',
  'manual', 'approved', true, true
from public.merchants m, public.categories c
where m.slug = 'cinnamon-hotels' and c.slug = 'travel'
on conflict (slug) do nothing;

insert into public.offers (
  country_code, title, slug, description, discount_text,
  merchant_id, category_id,
  valid_from, valid_to, terms_text,
  source_url, source_type, status, is_active, is_featured
)
select
  'LK',
  '5% Cashback on All Fuel Purchases',
  'boc-5-cashback-fuel',
  'Earn 5% cashback on every fuel purchase at CPC and Lanka IOC outlets when you use your BOC Mastercard Credit Card.',
  '5% cashback',
  m.id, c.id,
  '2026-01-01', '2026-06-30',
  'Maximum cashback of Rs. 250 per fill. Valid at all CPC and Lanka IOC outlets.',
  'https://www.boc.lk',
  'manual', 'approved', true, false
from public.merchants m, public.categories c
where m.slug = 'cpc-lanka-ioc' and c.slug = 'shopping'
on conflict (slug) do nothing;

insert into public.offers (
  country_code, title, slug, description, discount_text,
  merchant_id, category_id,
  valid_from, valid_to, terms_text,
  source_url, source_type, status, is_active, is_featured
)
select
  'LK',
  '12% Off on Abans Electronics',
  'sampath-12-off-abans',
  'Get 12% off on selected electronics and home appliances at Abans showrooms with your Sampath Mastercard Credit Card.',
  '12% off',
  m.id, c.id,
  '2026-03-01', '2026-06-30',
  'Valid on selected items only. Minimum purchase of Rs. 15,000 required. Not valid on already discounted items.',
  'https://www.sampath.lk',
  'manual', 'approved', true, false
from public.merchants m, public.categories c
where m.slug = 'abans' and c.slug = 'electronics'
on conflict (slug) do nothing;

insert into public.offers (
  country_code, title, slug, description, discount_text,
  merchant_id, category_id,
  valid_from, valid_to, terms_text,
  source_url, source_type, status, is_active, is_featured
)
select
  'LK',
  'Buy 1 Get 1 Free – Hotel Buffet Dining',
  'hnb-bogo-hotel-buffet',
  'Enjoy a Buy 1 Get 1 complimentary buffet offer at participating hotel restaurants with your HNB Visa card.',
  'Buy 1 Get 1',
  m.id, c.id,
  '2026-05-01', '2026-07-31',
  'Valid for buffet dining only. Advance reservation required. Valid Fridays and Saturdays only.',
  'https://www.hnb.lk',
  'manual', 'approved', true, true
from public.merchants m, public.categories c
where m.slug = 'hotel-restaurants' and c.slug = 'dining'
on conflict (slug) do nothing;

insert into public.offers (
  country_code, title, slug, description, discount_text,
  merchant_id, category_id,
  valid_from, valid_to, terms_text,
  source_url, source_type, status, is_active, is_featured
)
select
  'LK',
  '0% Installments for 12 Months at Singer',
  'boc-0-installment-singer',
  'Purchase any Singer home appliance and enjoy 0% interest installments for up to 12 months with your BOC Mastercard Credit Card.',
  '0% for 12 months',
  m.id, c.id,
  '2026-01-01', '2026-12-31',
  'Minimum purchase of Rs. 25,000 required. Processing fee of 1% applies. Valid at all Singer showrooms.',
  'https://www.boc.lk',
  'manual', 'approved', true, false
from public.merchants m, public.categories c
where m.slug = 'singer-sri-lanka' and c.slug = 'electronics'
on conflict (slug) do nothing;

insert into public.offers (
  country_code, title, slug, description, discount_text,
  merchant_id, category_id,
  valid_from, valid_to, terms_text,
  source_url, source_type, status, is_active, is_featured
)
select
  'LK',
  '5% Cashback at Cargills Food City',
  'combank-5-cashback-cargills',
  'Enjoy 5% cashback every time you shop at Cargills Food City with any Commercial Bank credit or debit card.',
  '5% cashback',
  m.id, c.id,
  '2026-03-01', '2026-08-31',
  'Maximum cashback of Rs. 750 per transaction. Valid for minimum spend of Rs. 2,500.',
  'https://www.combank.lk',
  'manual', 'approved', true, false
from public.merchants m, public.categories c
where m.slug = 'cargills-food-city' and c.slug = 'supermarket'
on conflict (slug) do nothing;

-- ============================================================
-- offer_bank_rules  (link each sample offer to its bank rules)
-- ============================================================

-- ComBank dining 20% off → ComBank, credit only
insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
select o.id, b.id, 'credit', null
from public.offers o, public.banks b
where o.slug = 'combank-20-off-selected-restaurants'
  and b.slug = 'commercial-bank'
on conflict do nothing;

-- Sampath cashback Keells → Sampath, both types
insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
select o.id, b.id, null, null
from public.offers o, public.banks b
where o.slug = 'sampath-10-cashback-keells-super'
  and b.slug = 'sampath-bank'
on conflict do nothing;

-- HNB Cinnamon Hotels → HNB, credit, visa
insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
select o.id, b.id, 'credit', 'visa'
from public.offers o, public.banks b
where o.slug = 'hnb-15-off-cinnamon-hotels'
  and b.slug = 'hnb'
on conflict do nothing;

-- BOC fuel cashback → BOC, credit, mastercard
insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
select o.id, b.id, 'credit', 'mastercard'
from public.offers o, public.banks b
where o.slug = 'boc-5-cashback-fuel'
  and b.slug = 'boc'
on conflict do nothing;

-- Sampath Abans → Sampath, credit, mastercard
insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
select o.id, b.id, 'credit', 'mastercard'
from public.offers o, public.banks b
where o.slug = 'sampath-12-off-abans'
  and b.slug = 'sampath-bank'
on conflict do nothing;

-- HNB BOGO → HNB, both types, visa
insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
select o.id, b.id, null, 'visa'
from public.offers o, public.banks b
where o.slug = 'hnb-bogo-hotel-buffet'
  and b.slug = 'hnb'
on conflict do nothing;

-- BOC Singer → BOC, credit, mastercard
insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
select o.id, b.id, 'credit', 'mastercard'
from public.offers o, public.banks b
where o.slug = 'boc-0-installment-singer'
  and b.slug = 'boc'
on conflict do nothing;

-- ComBank Cargills → ComBank, both types
insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
select o.id, b.id, null, null
from public.offers o, public.banks b
where o.slug = 'combank-5-cashback-cargills'
  and b.slug = 'commercial-bank'
on conflict do nothing;
