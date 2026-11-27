-- Publish a candidate and its attribution as a single transaction.
-- Existing approved offers keep their URLs. Backfill only evidence stored with their candidates.

insert into public.categories (name, slug, icon, is_active) values
  ('Online shopping', 'online', 'ShoppingBag', true),
  ('Healthcare', 'healthcare', 'HeartPulse', true),
  ('Lifestyle', 'lifestyle', 'Sparkles', true)
on conflict (slug) do nothing;

insert into public.banks (country_code, name, slug, short_name, website_url, is_active)
values ('LK', 'DFCC Bank PLC', 'dfcc-bank', 'DFCC', 'https://www.dfcc.lk/', true)
on conflict (slug) do nothing;

insert into public.cards (bank_id, name, slug, card_type, network, is_active)
select bank.id, card.name, card.slug, card.card_type, 'visa', true
from public.banks bank
cross join (values
  ('Visa Credit Card', 'dfcc-bank-visa-credit', 'credit'),
  ('Visa Debit Card', 'dfcc-bank-visa-debit', 'debit')
) as card(name, slug, card_type)
where bank.slug = 'dfcc-bank'
on conflict do nothing;

insert into public.scrape_sources (bank_id, name, source_url, source_type, is_active)
select bank.id, 'DFCC Online and Hotel Card Offers',
  'https://www.dfcc.lk/en/dfcc-card-offers/online-promotion', 'html', true
from public.banks bank
where bank.slug = 'dfcc-bank' and not exists (
  select 1 from public.scrape_sources source
  where source.bank_id = bank.id
    and source.source_url = 'https://www.dfcc.lk/en/dfcc-card-offers/online-promotion'
);

create function public.scraped_category_slug(raw_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when label ~ '^(dining|dining offers|restaurants?|food restaurants|food and restaurants|food and beverages|enjoy exclusive savings on dining)$' then 'dining'
    when label ~ '^(travel|travel offers|hotels?|hotel offers|hotel stays|travel and leisure|travel and hotels|accommodation)$'
      or label like 'enjoy exclusive savings on your next hotel stay %'
      or label like 'unlock special travel experiences %' then 'travel'
    when label ~ '^(super ?markets?|supermarket offers|grocery|groceries)$' then 'supermarket'
    when label ~ '^(electronics|electronics and furniture|home care electronics|home appliances|electrical and electronics)$' then 'electronics'
    when label ~ '^(shopping|fashion|clothing|jewell?ery|jewellers|footwear|shoes accessories|fashion and accessories|fashion jewellery)$'
      or label like 'enjoy special saving at a range of clothing %' then 'shopping'
    when label ~ '^(online|online stores|online shopping|e commerce)$' then 'online'
    when label ~ '^(healthcare|health care|health and wellness|healthcare and wellness|health and insurance)$' then 'healthcare'
    when label ~ '^(lifestyle|leisure|wellness|entertainment)$' then 'lifestyle'
  end
  from (
    select trim(regexp_replace(lower(substring(raw_text from '(?:^| \| )Category: ([^|]+)')), '[^a-z0-9]+', ' ', 'g')) as label
  ) as category
$$;

create function public.scraped_card_type(bank_slug text, raw_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when bank_slug = 'amana-bank' and evidence = 'visa debit' then 'debit'
    when bank_slug in ('hnb', 'peoples-bank', 'ndb-bank', 'dfcc-bank')
      and evidence ~ '^(credit|debit)( cards?( holders?)?| cardholders?)?$'
    then split_part(evidence, ' ', 1)
  end
  from (
    select lower(trim(substring(raw_text from '(?:^| \| )Card(?: type)?: ([^|]+)'))) as evidence
  ) as card
$$;

create function public.scraped_card_network(bank_slug text, raw_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when bank_slug = 'amana-bank' and raw_text ~* '(^| \| )Card: Visa Debit( \| |$)' then 'visa'
  end
$$;

revoke all on function public.scraped_category_slug(text) from public, anon, authenticated;
revoke all on function public.scraped_card_type(text, text) from public, anon, authenticated;
revoke all on function public.scraped_card_network(text, text) from public, anon, authenticated;
grant execute on function public.scraped_category_slug(text) to service_role;
grant execute on function public.scraped_card_type(text, text) to service_role;
grant execute on function public.scraped_card_network(text, text) to service_role;

create function public.publish_scraped_candidate(candidate_id uuid, offer_slug text)
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

  select id into target_category from public.categories
  where slug = public.scraped_category_slug(candidate.raw_text) and is_active;

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

  update public.scraped_offer_candidates set status = 'approved', offer_id = published_offer_id
  where id = candidate_id;
  return true;
end;
$$;

revoke all on function public.publish_scraped_candidate(uuid, text) from public, anon, authenticated;
grant execute on function public.publish_scraped_candidate(uuid, text) to service_role;

-- Recover offers left without an issuer by the previous multi-step publisher.
-- Require an unambiguous match in both directions and an active source.
with matches as (
  select offer.id as offer_id, candidate.id as candidate_id,
    count(*) over (partition by offer.id) as candidates_per_offer,
    count(*) over (partition by candidate.id) as offers_per_candidate
  from public.offers offer
  join public.scraped_offer_candidates candidate
    on candidate.title = offer.title and candidate.source_url = offer.source_url
    and candidate.detected_valid_to is not distinct from offer.valid_to
  join public.scrape_sources source on source.id = candidate.scrape_source_id and source.is_active
  join public.banks bank on bank.id = source.bank_id and bank.is_active
  where offer.source_type = 'scraped' and offer.status = 'approved' and offer.is_active
    and (offer.valid_to is null or offer.valid_to >= (now() at time zone 'Asia/Colombo')::date)
    and candidate.offer_id is null and candidate.status = 'pending'
    and not exists (select 1 from public.offer_bank_rules rule where rule.offer_id = offer.id)
    and not exists (select 1 from public.offer_cards card where card.offer_id = offer.id)
), linked as (
  update public.scraped_offer_candidates candidate
  set offer_id = match.offer_id, status = 'approved'
  from matches match
  where candidate.id = match.candidate_id and match.candidates_per_offer = 1 and match.offers_per_candidate = 1
  returning candidate.offer_id, candidate.scrape_source_id, candidate.raw_text
)
insert into public.offer_bank_rules (offer_id, bank_id, card_type, network)
select linked.offer_id, bank.id, public.scraped_card_type(bank.slug, linked.raw_text),
  public.scraped_card_network(bank.slug, linked.raw_text)
from linked
join public.scrape_sources source on source.id = linked.scrape_source_id
join public.banks bank on bank.id = source.bank_id;

update public.offers offer
set category_id = category.id
from public.scraped_offer_candidates candidate
join public.categories category
  on category.slug = public.scraped_category_slug(candidate.raw_text) and category.is_active
where offer.id = candidate.offer_id and offer.source_type = 'scraped' and offer.category_id is null
  and candidate.status = 'approved' and offer.is_active and offer.status = 'approved';

update public.offer_bank_rules rule
set card_type = public.scraped_card_type(bank.slug, candidate.raw_text),
    network = public.scraped_card_network(bank.slug, candidate.raw_text)
from public.scraped_offer_candidates candidate
join public.offers offer on offer.id = candidate.offer_id
join public.scrape_sources source on source.id = candidate.scrape_source_id
join public.banks bank on bank.id = source.bank_id
where rule.offer_id = offer.id and rule.bank_id = bank.id
  and rule.card_type is null and rule.network is null
  and rule.id = (
    select original.id from public.offer_bank_rules original
    where original.offer_id = offer.id and original.bank_id = bank.id
      and original.card_type is null and original.network is null
    order by original.id limit 1
  )
  and not exists (
    select 1 from public.offer_bank_rules existing
    where existing.offer_id = offer.id and existing.bank_id = bank.id and existing.id <> rule.id
      and (existing.card_type is not null or existing.network is not null)
  )
  and (public.scraped_card_type(bank.slug, candidate.raw_text) is not null
       or public.scraped_card_network(bank.slug, candidate.raw_text) is not null)
  and offer.source_type = 'scraped' and offer.status = 'approved' and offer.is_active
  and candidate.status = 'approved';

update public.offers offer
set title = regexp_replace(offer.title, '^slug\}\}["'']?>\s*', '', 'i')
from public.scraped_offer_candidates candidate
join public.scrape_sources source on source.id = candidate.scrape_source_id
join public.banks bank on bank.id = source.bank_id
where offer.id = candidate.offer_id and bank.slug = 'seylan-bank'
  and offer.source_type = 'scraped' and offer.title = candidate.title
  and offer.title ~* '^slug\}\}["'']?>\s*\S';

-- Standard Chartered's Sri Lankan retail cards moved to DFCC. Keep the historical bank row.
update public.scrape_sources source
set is_active = false
from public.banks bank
where source.bank_id = bank.id and bank.slug = 'standard-chartered'
  and source.source_url = 'https://www.sc.com/lk/promotions/the-good-life-privileges/';

alter policy "public_read_approved_offers" on public.offers using (
  status = 'approved' and is_active
  and (valid_from is null or valid_from <= (now() at time zone 'Asia/Colombo')::date)
  and (valid_to is null or valid_to >= (now() at time zone 'Asia/Colombo')::date)
);

alter policy "public_read_offer_cards" on public.offer_cards using (
  exists (
    select 1 from public.offers offer where offer.id = offer_id and offer.status = 'approved' and offer.is_active
      and (offer.valid_from is null or offer.valid_from <= (now() at time zone 'Asia/Colombo')::date)
      and (offer.valid_to is null or offer.valid_to >= (now() at time zone 'Asia/Colombo')::date)
  )
);

alter policy "public_read_offer_bank_rules" on public.offer_bank_rules using (
  exists (
    select 1 from public.offers offer where offer.id = offer_id and offer.status = 'approved' and offer.is_active
      and (offer.valid_from is null or offer.valid_from <= (now() at time zone 'Asia/Colombo')::date)
      and (offer.valid_to is null or offer.valid_to >= (now() at time zone 'Asia/Colombo')::date)
  )
);
