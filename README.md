# CardPromo LK

A Progressive Web App (PWA) + admin panel to discover and manage credit/debit card promotions in Sri Lanka.

## Features

**Public site**
- Browse active promotions from multiple Sri Lankan banks
- Filter by bank, category, card type, and card network
- Full-text search across offers, merchants, and banks
- **My Cards** — select your cards locally (no login, stored in browser)
- Show only promotions matched to your selected cards
- Offer detail pages with terms and conditions
- SEO-optimised with pre-rendered static HTML, structured data, and sitemap
- Installable as a PWA with offline support

**Admin panel** (`/admin/*`)
- Full CRUD for banks, cards, categories, merchants, and offers
- Scraped candidate review workflow (approve / reject / mark duplicate)
- Scrape run history viewer

**Scraper** (`scrapers/`)
- Daily GitHub Actions cron extracts bank promotions into reviewable candidates
- Candidates never auto-publish — admin review required

---

## Monorepo structure

```
/
├── apps/web/          React 19 + Vite 8 frontend + admin panel
├── supabase/          SQL migrations (001 schema, 002 RLS, 003 seed)
├── scrapers/          Python scraping pipeline
├── .github/workflows/ GitHub Actions (scheduled scraper)
└── docs/              Architecture and database reference
```

---

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Database / Auth | Supabase (PostgreSQL + RLS) |
| SEO | react-helmet-async + SSG prerender |
| PWA | vite-plugin-pwa |
| Scraper | Python 3.11 + BeautifulSoup4 + Pydantic |
| Automation | GitHub Actions (daily cron) |

---

## Quick start (frontend)

### Prerequisites

- Node.js 20+, npm 10+
- A Supabase project with migrations applied (see below)

### 1. Install

```bash
npm install          # from monorepo root
```

### 2. Configure environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Fill in:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_BASE_URL=http://localhost:5173
```

### 3. Run dev server

```bash
npm run dev          # starts on http://localhost:5173
```

### 4. Production build

```bash
npm run build        # client + SSR prerender + sitemap.xml
npm run build:client # fast client-only build
npm run preview      # preview the built output
```

---

## Supabase setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy your **Project URL** and **anon key** from Project Settings → API
3. Open the **SQL Editor** and run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_seed_base_data.sql`
4. Create your first admin user — see [`docs/database.md`](docs/database.md)

---

## Scraper setup

See [`scrapers/README.md`](scrapers/README.md) for full instructions.

**Local run:**
```bash
cd scrapers
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in SUPABASE_SERVICE_ROLE_KEY
python main.py
```

---

## GitHub Actions (automated daily scraping)

The workflow at `.github/workflows/run-scrapers.yml` runs the scraper daily
at **18:30 UTC** (midnight Sri Lanka time).

### Required GitHub secrets

Add these in **GitHub repo → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (Project Settings → API) |

### Run manually

1. GitHub repo → **Actions** tab
2. Select **"Run Promotion Scrapers"**
3. Click **"Run workflow"** → confirm

### Disable the schedule temporarily

Comment out the `schedule:` block in `.github/workflows/run-scrapers.yml`:

```yaml
on:
  # schedule:
  #   - cron: "30 18 * * *"
  workflow_dispatch:
```

---

## Deployment

### Cloudflare Pages (recommended)

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `apps/web/dist` |
| Root directory | *(leave blank — uses monorepo root)* |

Add environment variables:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_APP_BASE_URL=https://your-domain.com
```

Add `apps/web/public/_redirects` for client-side routing:
```
/* /index.html 200
```

### GitHub Pages / Netlify / Vercel

All support the static `dist/` output. Set the same environment variables.

---

## Privacy

CardPromo LK never asks for card numbers, CVV, expiry dates, NIC, or phone numbers.
Only non-sensitive identifiers (bank name, card type, network) are stored locally in the browser.
The service role key is only used server-side and never exposed in frontend code.

## Disclaimer

Promotion information is collected from public sources and may change without notice.
Please verify offer details with the relevant bank or merchant before making a purchase.

---

© 2026 CardPromo LK
