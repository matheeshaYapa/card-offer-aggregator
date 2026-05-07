# CardPromo LK — Database

## Overview

CardPromo LK uses Supabase (PostgreSQL) as its backend.

All migrations live in `supabase/migrations/` and must be run in order.

## Schema

```
countries → banks → cards
            banks → offer_bank_rules → offers
                    offer_cards      → offers
merchants → offers → categories
offers → scraped_offer_candidates (via scrape pipeline)
```

## Tables

| Table | Purpose |
|---|---|
| `countries` | Supported countries (LK, future: IN, SG, AE) |
| `banks` | Sri Lankan banks with slugs for SEO URLs |
| `categories` | Offer categories (dining, shopping, travel, etc.) |
| `merchants` | Merchants/businesses running the promotions |
| `cards` | Bank cards (credit/debit, Visa/Mastercard/Amex) |
| `offers` | The main promotions table |
| `offer_cards` | Explicit per-card eligibility for an offer |
| `offer_bank_rules` | Broad bank/card-type/network rules for an offer |
| `scrape_sources` | URLs the scraper targets |
| `scrape_runs` | Log of each scraper execution |
| `scraped_offer_candidates` | Raw scraped data awaiting admin review |
| `admin_users` | Maps Supabase Auth UIDs to admin role |

## Offer Status Flow

```
manual entry → draft → pending_review → approved → (displayed publicly)
                                      ↘ rejected
scraped      → scraped_offer_candidates → (admin review) → approved offer
```

## Row Level Security

- **Anonymous users**: read-only access to approved, active, non-expired offers + supporting data
- **Admin users**: full CRUD via `is_admin()` function that checks `admin_users` table
- **Scraper**: uses service role key (bypasses RLS) — only via GitHub Actions secrets

## Running Migrations

### Remote (Supabase Dashboard)

1. Open Supabase project → SQL Editor
2. Run migrations in order: 001, 002, 003

### Using Supabase CLI

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

## Creating the First Admin

After running migrations:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → enter email + password → confirm
3. Copy the user UUID
4. Run in SQL Editor:

```sql
insert into admin_users (user_id, email, role, is_active)
values (
  '<paste-auth-user-id-here>',
  'your-email@example.com',
  'admin',
  true
);
```

5. Visit `/admin/login` and sign in
