alter table public.scraped_offer_candidates
  add column if not exists offer_id uuid references public.offers(id) on delete set null;

create index if not exists idx_candidates_offer_id on public.scraped_offer_candidates(offer_id);
