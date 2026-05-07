# CardPromo LK — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Pages / Netlify / Vercel                     │
│                                                          │
│  apps/web/  (React 19 + Vite + Tailwind v4)             │
│  ├── Public pages   /  /offers  /bank/:slug             │
│  └── Admin panel    /admin/*  (protected by Supabase)   │
└──────────────────────────┬──────────────────────────────┘
                           │ Supabase JS SDK
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Auth + RLS)                      │
│  ├── Public data:   banks, cards, categories, offers     │
│  ├── Admin data:    admin_users, all tables              │
│  └── Scraper data:  scrape_sources, runs, candidates     │
└──────────────────────────▲──────────────────────────────┘
                           │ Service role key (secrets only)
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions (daily cron)                             │
│  scrapers/  (Python + BeautifulSoup/Playwright)          │
│  ├── Fetches bank promotion pages                        │
│  ├── Saves to scraped_offer_candidates                   │
│  └── Never auto-publishes                                │
└─────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Public users never log in
Selected cards stored in `localStorage` as `cardpromo.selectedCards` (non-sensitive metadata only).

### 2. Scraper → Admin review → Public
No scraped content ever goes directly to users. All scraper output lands in `scraped_offer_candidates` with status `pending`. Admins approve/reject manually.

### 3. Single React app for public + admin
Routes under `/admin/*` are lazy-loaded and protected by `ProtectedRoute` which checks Supabase session + `admin_users` table membership.

### 4. RLS is the real security boundary
Frontend route guards are UX only. The Supabase anon key cannot read draft, rejected, or scraped data. The service role key (used by scraper) is only in GitHub Actions secrets.

### 5. Slugs for SEO URLs
All major entities (banks, categories, merchants, offers) have a unique `slug` field. URLs are `/bank/commercial-bank` not `/bank/abc-uuid-123`.

### 6. Static site generation (SSG)
The `build` script pre-renders each public route to static HTML using Vite SSR + react-dom/server. Meta tags and JSON-LD are injected at build time from Helmet context. Content hydrates client-side from Supabase.

## Monorepo Structure

```
/
├── apps/web/          React + Vite frontend + admin panel
├── supabase/          SQL migrations and local dev config
├── scrapers/          Python scraper pipeline (Phase 4)
├── .github/workflows/ GitHub Actions (Phase 5)
└── docs/              Architecture, database, deployment docs
```
