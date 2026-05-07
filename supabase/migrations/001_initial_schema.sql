-- ============================================================
-- CardPromo LK — Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- countries
-- ============================================================
create table if not exists public.countries (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- banks
-- ============================================================
create table if not exists public.banks (
  id           uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete restrict,
  name         text not null,
  slug         text unique not null,
  short_name   text,
  website_url  text,
  logo_url     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_banks_country_code on public.banks(country_code);
create index if not exists idx_banks_slug on public.banks(slug);

-- ============================================================
-- categories
-- ============================================================
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  icon       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- merchants
-- ============================================================
create table if not exists public.merchants (
  id           uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete restrict,
  name         text not null,
  slug         text unique not null,
  category_id  uuid references public.categories(id) on delete set null,
  website_url  text,
  logo_url     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_merchants_country_code on public.merchants(country_code);
create index if not exists idx_merchants_slug on public.merchants(slug);

-- ============================================================
-- cards
-- ============================================================
create table if not exists public.cards (
  id        uuid primary key default gen_random_uuid(),
  bank_id   uuid not null references public.banks(id) on delete cascade,
  name      text not null,
  slug      text unique not null,
  card_type text not null check (card_type in ('credit', 'debit')),
  network   text not null check (network in ('visa', 'mastercard', 'amex', 'other')),
  tier      text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cards_bank_id on public.cards(bank_id);
create index if not exists idx_cards_slug on public.cards(slug);

-- ============================================================
-- offers
-- ============================================================
create table if not exists public.offers (
  id           uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code) on delete restrict,
  title        text not null,
  slug         text unique not null,
  description  text,
  discount_text text,
  merchant_id  uuid references public.merchants(id) on delete set null,
  category_id  uuid references public.categories(id) on delete set null,
  valid_from   date,
  valid_to     date,
  terms_text   text,
  source_url   text,
  source_type  text not null default 'manual'
               check (source_type in ('manual', 'scraped', 'imported', 'bank_submission')),
  status       text not null default 'draft'
               check (status in ('draft', 'pending_review', 'approved', 'rejected', 'expired')),
  is_featured  boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists idx_offers_status on public.offers(status);
create index if not exists idx_offers_country_code on public.offers(country_code);
create index if not exists idx_offers_slug on public.offers(slug);
create index if not exists idx_offers_category_id on public.offers(category_id);
create index if not exists idx_offers_merchant_id on public.offers(merchant_id);
create index if not exists idx_offers_valid_to on public.offers(valid_to);

-- ============================================================
-- offer_cards  (explicit per-card eligibility)
-- ============================================================
create table if not exists public.offer_cards (
  id       uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  card_id  uuid not null references public.cards(id) on delete cascade,
  unique (offer_id, card_id)
);

create index if not exists idx_offer_cards_offer_id on public.offer_cards(offer_id);
create index if not exists idx_offer_cards_card_id  on public.offer_cards(card_id);

-- ============================================================
-- offer_bank_rules  (broad bank/type/network eligibility)
-- ============================================================
create table if not exists public.offer_bank_rules (
  id        uuid primary key default gen_random_uuid(),
  offer_id  uuid not null references public.offers(id) on delete cascade,
  bank_id   uuid not null references public.banks(id) on delete cascade,
  card_type text check (card_type in ('credit', 'debit')),
  network   text check (network in ('visa', 'mastercard', 'amex', 'other')),
  unique (offer_id, bank_id, card_type, network)
);

create index if not exists idx_offer_bank_rules_offer_id on public.offer_bank_rules(offer_id);
create index if not exists idx_offer_bank_rules_bank_id  on public.offer_bank_rules(bank_id);

-- ============================================================
-- scrape_sources
-- ============================================================
create table if not exists public.scrape_sources (
  id              uuid primary key default gen_random_uuid(),
  bank_id         uuid references public.banks(id) on delete set null,
  name            text not null,
  source_url      text not null,
  source_type     text not null check (source_type in ('html', 'pdf')),
  is_active       boolean not null default true,
  last_scraped_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- scrape_runs
-- ============================================================
create table if not exists public.scrape_runs (
  id               uuid primary key default gen_random_uuid(),
  scrape_source_id uuid references public.scrape_sources(id) on delete set null,
  status           text not null check (status in ('running', 'success', 'failed', 'partial')),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  offers_found     int not null default 0,
  error_message    text
);

create index if not exists idx_scrape_runs_source_id on public.scrape_runs(scrape_source_id);
create index if not exists idx_scrape_runs_started_at on public.scrape_runs(started_at desc);

-- ============================================================
-- scraped_offer_candidates
-- ============================================================
create table if not exists public.scraped_offer_candidates (
  id                uuid primary key default gen_random_uuid(),
  scrape_run_id     uuid references public.scrape_runs(id) on delete set null,
  scrape_source_id  uuid references public.scrape_sources(id) on delete set null,
  title             text,
  description       text,
  raw_text          text,
  source_url        text,
  detected_merchant text,
  detected_discount text,
  detected_valid_from date,
  detected_valid_to   date,
  confidence_score  numeric(3,2) check (confidence_score between 0 and 1),
  candidate_hash    text unique,
  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'duplicate')),
  created_at        timestamptz not null default now()
);

create index if not exists idx_candidates_status on public.scraped_offer_candidates(status);
create index if not exists idx_candidates_run_id on public.scraped_offer_candidates(scrape_run_id);
create index if not exists idx_candidates_hash on public.scraped_offer_candidates(candidate_hash);

-- ============================================================
-- admin_users
-- ============================================================
create table if not exists public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique not null,   -- references auth.users(id)
  email      text unique not null,
  role       text not null default 'admin',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_banks_updated_at
  before update on public.banks
  for each row execute function public.set_updated_at();

create trigger trg_merchants_updated_at
  before update on public.merchants
  for each row execute function public.set_updated_at();

create trigger trg_cards_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

create trigger trg_offers_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

create trigger trg_scrape_sources_updated_at
  before update on public.scrape_sources
  for each row execute function public.set_updated_at();
