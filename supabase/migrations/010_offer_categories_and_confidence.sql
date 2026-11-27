-- 010: Categories for scraped offers + evidence-based confidence.
--
-- Requires 009_scraped_offer_quality.sql.
--
-- Until now every scraped offer was published with category_id = NULL, so the
-- public category filter returned nothing for them. The scraper now classifies
-- each candidate (scrapers/src/extractors/category_extractor.py) and stores the
-- result here; the publisher uses it. Existing offers are backfilled with
-- scrapers/backfill_categories.py.
--
-- The scraper also stores *why* it trusts a candidate: parser_score (how
-- complete the extraction was), quality_flags (checks that failed) and the
-- final confidence_score. review_source records who approved or rejected a
-- candidate, so scrapers/calibrate_confidence.py can measure the score
-- against admin decisions.

insert into public.categories (name, slug, icon, is_active) values
  ('Online shopping', 'online', 'ShoppingBag', true),
  ('Healthcare', 'healthcare', 'HeartPulse', true),
  ('Lifestyle', 'lifestyle', 'Sparkles', true),
  ('Automotive & fuel', 'automotive', 'Car', true),
  ('Education', 'education', 'GraduationCap', true),
  ('Bills & services', 'services', 'Receipt', true)
on conflict (slug) do nothing;

alter table public.scraped_offer_candidates
  add column if not exists parser_score numeric(3,2) check (parser_score between 0 and 1),
  add column if not exists quality_flags text[] not null default '{}',
  add column if not exists detected_category_id uuid references public.categories(id) on delete set null,
  add column if not exists category_confidence numeric(3,2) check (category_confidence between 0 and 1),
  add column if not exists review_source text check (review_source in ('auto', 'admin'));

-- Rows reviewed before this migration: rejections and duplicates were always
-- made by an admin; approvals could have been either, so they stay unknown.
update public.scraped_offer_candidates
set review_source = 'admin'
where review_source is null and status in ('rejected', 'duplicate');

-- Flags that must never be auto-published. Keep in sync with HARD_FLAGS in
-- scrapers/src/confidence.py.
create or replace function public.scraped_hard_flags()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['placeholder_title', 'generic_title', 'benefit_not_in_text', 'implausible_benefit', 'batch_anomaly']
$$;

create or replace function public.publish_scraped_candidate(candidate_id uuid, offer_slug text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  candidate public.scraped_offer_candidates%rowtype;
  issuer_id uuid;
  issuer_slug text;
  target_category uuid;
  target_merchant uuid;
  published_offer_id uuid;
begin
  select * into candidate from public.scraped_offer_candidates
  where id = candidate_id for update;

  if not found or candidate.status <> 'pending' or candidate.offer_id is not null
    or coalesce(candidate.confidence_score, 0) < 0.80
    or candidate.quality_flags && public.scraped_hard_flags()
    or nullif(btrim(candidate.title), '') is null
    or nullif(btrim(candidate.detected_discount), '') is null
    or candidate.detected_valid_to is null
    or candidate.detected_valid_to < (now() at time zone 'Asia/Colombo')::date
    or candidate.detected_valid_from > candidate.detected_valid_to
    or candidate.source_url is null or candidate.source_url !~ '^https://'
  then
    return false;
  end if;

  select bank.id, bank.slug into issuer_id, issuer_slug
  from public.scrape_sources source
  join public.banks bank on bank.id = source.bank_id
  where source.id = candidate.scrape_source_id and source.is_active and bank.is_active;

  if issuer_id is null then
    return false;
  end if;

  -- The scraper's classification first, then the bank's own label (009).
  select id into target_category from public.categories
  where id = candidate.detected_category_id and is_active;
  if target_category is null then
    select id into target_category from public.categories
    where slug = public.scraped_category_slug(candidate.raw_text) and is_active;
  end if;

  select merchant.id into target_merchant from public.merchants merchant
  where merchant.country_code = 'LK' and merchant.is_active
    and lower(merchant.name) = lower(candidate.detected_merchant)
  order by merchant.id
  limit 1;

  insert into public.offers (
    country_code, title, slug, description, discount_text, merchant_id, category_id,
    valid_from, valid_to, source_url, source_type, status, is_active, published_at
  ) values (
    'LK', candidate.title, offer_slug, candidate.description, candidate.detected_discount,
    target_merchant, target_category, candidate.detected_valid_from, candidate.detected_valid_to,
    candidate.source_url, 'scraped', 'approved', true, now()
  ) returning id into published_offer_id;

  insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
  values (
    published_offer_id, issuer_id, public.scraped_card_type(issuer_slug, candidate.raw_text),
    public.scraped_card_network(issuer_slug, candidate.raw_text)
  );

  if issuer_slug = 'dfcc-bank' then
    insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
    select published_offer_id, bank.id, eligibility.parts[1], null
    from public.banks bank
    cross join lateral regexp_match(
      lower(candidate.raw_text), 'standard chartered (credit|debit) cards now serviced by dfcc bank'
    ) as eligibility(parts)
    where bank.slug = 'standard-chartered' and bank.is_active;
  end if;

  update public.scraped_offer_candidates
  set status = 'approved', offer_id = published_offer_id, review_source = 'auto'
  where id = candidate_id;
  return true;
end;
$$;

revoke all on function public.scraped_hard_flags() from public, anon, authenticated;
grant execute on function public.scraped_hard_flags() to service_role;
revoke all on function public.publish_scraped_candidate(uuid, text) from public, anon, authenticated;
grant execute on function public.publish_scraped_candidate(uuid, text) to service_role;

-- Offers published by an earlier publisher keep a category if their candidate
-- has one now (filled by backfill_categories.py or a later scrape).
update public.offers offer
set category_id = candidate.detected_category_id
from public.scraped_offer_candidates candidate
join public.categories category on category.id = candidate.detected_category_id and category.is_active
where candidate.offer_id = offer.id and offer.category_id is null and offer.source_type = 'scraped';
