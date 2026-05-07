-- ============================================================
-- CardPromo LK — Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- ============================================================
-- Security model:
--   anonymous  → read approved public data only
--   admin      → full CRUD (checked via admin_users table)
--   service    → full access via service role key (scrapers only)
-- ============================================================

-- Helper: check if the current auth.uid() is an active admin
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
      and is_active = true
  );
$$;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
alter table public.countries                 enable row level security;
alter table public.banks                     enable row level security;
alter table public.categories                enable row level security;
alter table public.merchants                 enable row level security;
alter table public.cards                     enable row level security;
alter table public.offers                    enable row level security;
alter table public.offer_cards               enable row level security;
alter table public.offer_bank_rules          enable row level security;
alter table public.scrape_sources            enable row level security;
alter table public.scrape_runs               enable row level security;
alter table public.scraped_offer_candidates  enable row level security;
alter table public.admin_users               enable row level security;

-- ============================================================
-- countries — public read
-- ============================================================
create policy "public_read_countries"
  on public.countries for select
  using (is_active = true);

create policy "admin_all_countries"
  on public.countries for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- banks — public read active
-- ============================================================
create policy "public_read_banks"
  on public.banks for select
  using (is_active = true);

create policy "admin_all_banks"
  on public.banks for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- categories — public read active
-- ============================================================
create policy "public_read_categories"
  on public.categories for select
  using (is_active = true);

create policy "admin_all_categories"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- merchants — public read active
-- ============================================================
create policy "public_read_merchants"
  on public.merchants for select
  using (is_active = true);

create policy "admin_all_merchants"
  on public.merchants for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- cards — public read active
-- ============================================================
create policy "public_read_cards"
  on public.cards for select
  using (is_active = true);

create policy "admin_all_cards"
  on public.cards for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- offers — public read approved+active+non-expired only
-- ============================================================
create policy "public_read_approved_offers"
  on public.offers for select
  using (
    status = 'approved'
    and is_active = true
    and (valid_to is null or valid_to >= current_date)
  );

create policy "admin_all_offers"
  on public.offers for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- offer_cards — public read (only for approved offers)
-- ============================================================
create policy "public_read_offer_cards"
  on public.offer_cards for select
  using (
    exists (
      select 1 from public.offers o
      where o.id = offer_id
        and o.status = 'approved'
        and o.is_active = true
        and (o.valid_to is null or o.valid_to >= current_date)
    )
  );

create policy "admin_all_offer_cards"
  on public.offer_cards for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- offer_bank_rules — public read (only for approved offers)
-- ============================================================
create policy "public_read_offer_bank_rules"
  on public.offer_bank_rules for select
  using (
    exists (
      select 1 from public.offers o
      where o.id = offer_id
        and o.status = 'approved'
        and o.is_active = true
        and (o.valid_to is null or o.valid_to >= current_date)
    )
  );

create policy "admin_all_offer_bank_rules"
  on public.offer_bank_rules for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- scrape_sources — admin only
-- ============================================================
create policy "admin_all_scrape_sources"
  on public.scrape_sources for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- scrape_runs — admin only
-- ============================================================
create policy "admin_all_scrape_runs"
  on public.scrape_runs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- scraped_offer_candidates — admin only
-- ============================================================
create policy "admin_all_candidates"
  on public.scraped_offer_candidates for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- admin_users — admin read self; no public access
-- ============================================================
create policy "admin_read_own_record"
  on public.admin_users for select
  using (user_id = auth.uid());

create policy "admin_manage_admin_users"
  on public.admin_users for all
  using (public.is_admin())
  with check (public.is_admin());
