# CardPromo LK

A production-ready Progressive Web App for discovering and managing credit and debit card promotions in Sri Lanka.

**Live demo target:** https://cardpromo.lk

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Monorepo structure](#3-monorepo-structure)
4. [Tech stack](#4-tech-stack)
5. [Public app features](#5-public-app-features)
6. [Admin panel features](#6-admin-panel-features)
7. [Scraper workflow](#7-scraper-workflow)
8. [Quick start](#8-quick-start)
9. [Environment variables](#9-environment-variables)
10. [Supabase setup](#10-supabase-setup)
11. [Deployment](#11-deployment)
12. [GitHub Actions scraper](#12-github-actions-scraper)
13. [SEO and PWA](#13-seo-and-pwa)
14. [Security notes](#14-security-notes)
15. [Known limitations](#15-known-limitations)
16. [Future roadmap](#16-future-roadmap)

---

## 1. Project overview

CardPromo LK aggregates credit and debit card promotions from Sri Lankan banks (HNB, Commercial Bank, Sampath, BOC, People's Bank, and others) into a single searchable, filterable web app.

Users can:
- Browse all current promotions without logging in
- Filter by bank, category, card type, or network
- Add their own cards and see only relevant offers
- Install the app to their home screen (PWA)

Admins can:
- Manage all reference data (banks, cards, categories, merchants)
- Create, edit, and publish offers manually
- Review scraped promotion candidates from bank websites
- View the scraper run history

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Cloudflare Pages (or Netlify / Vercel)                   │
│  apps/web/ — React 19 + Vite 8 + Tailwind CSS v4         │
│  ├── Public pages   /  /offers  /bank/:slug  /offer/:slug │
│  └── Admin panel    /admin/*  (Supabase Auth)             │
└──────────────────────────┬───────────────────────────────┘
                           │ @supabase/supabase-js (anon key)
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase — PostgreSQL + Auth + RLS                       │
│  ├── Public: banks, cards, categories, offers             │
│  ├── Admin:  all tables + write access                    │
│  └── Scraper: scrape_sources, scrape_runs, candidates     │
└──────────────────────────▲───────────────────────────────┘
                           │ Service role key (GitHub secrets only)
┌──────────────────────────────────────────────────────────┐
│  GitHub Actions — daily cron (18:30 UTC = midnight SLT)   │
│  scrapers/ — Python 3.11 + BeautifulSoup + Playwright     │
│  Saves to scraped_offer_candidates (status = pending)     │
│  Never auto-publishes — admin review always required      │
└──────────────────────────────────────────────────────────┘
```

**Key design principles:**
- Public users never log in. Selected cards stored in `localStorage` (non-sensitive metadata only).
- Scraped content is never published automatically. Admins approve/reject each candidate manually.
- RLS is the real security boundary. Frontend route guards are UX-only.
- The anon key cannot read draft, rejected, or scraped data.

---

## 3. Monorepo structure

```
/
├── apps/web/                  React 19 + Vite 8 frontend + admin panel
│   ├── src/
│   │   ├── app/App.tsx         All routes (public + admin)
│   │   ├── components/         UI components (layout, offers, admin, seo)
│   │   ├── hooks/              useSelectedCards, useOfferFilters, useAdminAuth, …
│   │   ├── lib/supabase/       Supabase client + all query functions
│   │   ├── pages/              public/ and admin/ page components
│   │   ├── styles/global.css   Tailwind v4 @theme{} + admin utility classes
│   │   ├── types/              Domain types (snake_case, matches Supabase schema)
│   │   └── utils/              dateUtils, seo, normalization, offerMatching
│   ├── scripts/
│   │   ├── prerender.ts        SSG: renders all public routes to static HTML
│   │   └── generate-sitemap.ts Writes sitemap.xml (fetches live slugs from Supabase)
│   ├── public/                 robots.txt, offline.html, og-cover.png, icons/
│   ├── index.html              App shell with <!--app-head--> and <!--app-html--> placeholders
│   └── vite.config.ts          Vite + Tailwind + PWA config
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql  12 tables + indexes
│       ├── 002_rls_policies.sql    RLS + is_admin() helper function
│       └── 003_seed_base_data.sql  5 banks, 10 cards, 5 categories, 12 merchants, 8 offers
├── scrapers/
│   ├── main.py                 Orchestrator — loads sources, runs scrapers, saves candidates
│   ├── requirements.txt        Python dependencies
│   ├── .env.example            Template for secrets (copy → .env)
│   ├── config/sources.yaml     Fallback source config (used when Supabase unavailable)
│   └── src/
│       ├── scrapers/           hnb_scraper.py (API-based), commercial_bank_scraper.py,
│       │                       sampath_scraper.py (cloudscraper + Playwright fallback)
│       ├── extractors/         date_extractor.py, discount_extractor.py, merchant_extractor.py
│       ├── models/             scraped_offer.py (Pydantic)
│       ├── db/                 supabase_client.py
│       └── utils/              hashing.py, text_cleaner.py, logger.py
├── .github/workflows/
│   └── run-scrapers.yml        Daily cron + manual dispatch
├── docs/
│   ├── architecture.md         System architecture diagram
│   ├── database.md             Schema reference + admin user creation
│   ├── deployment-guide.md     Step-by-step production deployment
│   ├── manual-setup-checklist.md  One-time manual tasks
│   └── security-checklist.md   Security decisions and verification
├── .gitignore                  Covers node_modules, dist, .env, .venv, __pycache__, .claude
├── .npmrc                      legacy-peer-deps=true (react-helmet-async compat)
└── package.json                Root workspace (workspaces: ["apps/web"])
```

---

## 4. Tech stack

| Layer | Tool | Version |
|---|---|---|
| Frontend framework | React | ^19.2.5 |
| Build tool | Vite | ^8.0.10 |
| Styling | Tailwind CSS + @tailwindcss/vite | ^4.2.4 |
| Routing | react-router-dom | ^7.14.2 |
| SEO / head tags | react-helmet-async | ^3.0.0 |
| Icons | lucide-react | ^1.14.0 |
| PWA | vite-plugin-pwa | ^1.2.0 |
| Database / Auth | @supabase/supabase-js | ^2.50.0 |
| TypeScript | typescript | ^6.0.3 |
| SSR/prerender | react-dom/server + tsx | — |
| Python scraper | Python 3.11 + BeautifulSoup4 + cloudscraper + Playwright | — |
| Automation | GitHub Actions | — |
| Hosting | Cloudflare Pages (recommended) | — |

---

## 5. Public app features

- **Browse promotions** — paginated grid of active offers with discount text, bank badge, expiry
- **Filter and search** — by bank, category, merchant, card type (credit/debit), network (Visa/Mastercard/Amex), text search
- **My Cards** — add your cards locally (no login, stored in `localStorage`). Offers are highlighted or filtered to match your cards.
- **Offer detail** — full terms, eligible banks, card types, source URL back to the bank's website
- **Bank pages** — `/bank/:slug` — all offers for a specific bank
- **Category pages** — `/category/:slug` — all offers in a category (dining, shopping, travel, etc.)
- **SEO-ready** — SSG pre-rendered HTML, `<title>`, meta description, canonical URL, Open Graph tags, JSON-LD structured data, sitemap.xml
- **PWA** — installable, works offline using service worker cache

---

## 6. Admin panel features

Access at `/admin/login`. Requires Supabase Auth + `admin_users` table entry.

- **Dashboard** — overview stats
- **Banks** — CRUD: name, slug, logo, website URL, active flag
- **Cards** — CRUD: linked to bank, card type, network, tier
- **Categories** — CRUD: name, slug, icon
- **Merchants** — CRUD: name, slug, category link, website
- **Offers** — CRUD with bank eligibility rules (broad: bank + card type + network) and explicit per-card links. Status flow: `draft → pending_review → approved`
- **Scrape candidates** — Review scraped offers. Filter by status (pending / approved / rejected / duplicate). Approve as offer (pre-filled form), reject, or mark duplicate.
- **Scrape runs** — History of scraper executions with timestamp, count, and error log.

---

## 7. Scraper workflow

```
GitHub Actions (daily 18:30 UTC)
  → main.py loads scrape_sources from Supabase (or config/sources.yaml fallback)
  → For each source:
      Creates scrape_run (status = running)
      Fetches HTML / calls API
      Extracts: title, discount, dates, merchant
      Generates SHA-256 candidate_hash (deduplication)
      Inserts to scraped_offer_candidates (status = pending)
      Updates scrape_run (status = success / failed)

Admin reviews at /admin/scraped-candidates
  → Approves → new Offer created (status = pending_review)
  → Admin sets offer status = approved → visible to public
```

**Per-bank scraping strategy:**

| Bank | Method | Notes |
|---|---|---|
| HNB | JSON API (`venus.hnb.lk`) | ~743 offers, 75 pages. No HTML parsing needed. |
| Commercial Bank | Server-rendered HTML | `<a href="/rewards-promotion/…">` link selector |
| Sampath Bank | `cloudscraper` + Playwright | Cloudflare-protected. Playwright used if HTML is a JS shell. |

---

## 8. Quick start

### Prerequisites

- Node.js 20+ and npm 10+
- A Supabase project (free tier works — see §10)
- Python 3.11+ (for running scrapers locally)

### 1. Clone and install

```bash
git clone https://github.com/your-username/card-offer-aggregator.git
cd card-offer-aggregator
npm install
```

### 2. Configure the frontend

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_BASE_URL=http://localhost:5173
```

### 3. Run the dev server

```bash
npm run dev       # starts at http://localhost:5173
```

### 4. Other useful commands

```bash
npm run build         # full production build: client + SSG prerender + sitemap
npm run build:client  # fast client-only build (no SSR/prerender)
npm run preview       # preview the built output at http://localhost:4173
npm run typecheck     # TypeScript type check (both tsconfig.json + tsconfig.node.json)
```

---

## 9. Environment variables

### Frontend (`apps/web/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL (e.g. `https://abc.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key — safe to expose in browser |
| `VITE_APP_BASE_URL` | ✅ | Public base URL for canonical URLs and sitemap (e.g. `https://cardpromo.lk`) |

> Never put `SUPABASE_SERVICE_ROLE_KEY` in the frontend env. It bypasses RLS and must stay server-side only.

### Scraper (`scrapers/.env`)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Same Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key — bypasses RLS. Never commit. |

---

## 10. Supabase setup

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New project** — choose a region close to Sri Lanka (e.g. Singapore)
3. Wait for provisioning (~2 minutes)

### Step 2 — Copy credentials

From **Project Settings → API**:
- Copy **Project URL** → `VITE_SUPABASE_URL` and `SUPABASE_URL`
- Copy **anon / public** key → `VITE_SUPABASE_ANON_KEY`
- Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret)

### Step 3 — Run migrations

Open **SQL Editor** in the Supabase dashboard and run these three files in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_seed_base_data.sql
```

Paste each file's content into a new SQL query and click **Run**.

### Step 4 — Create the first admin user

1. Go to **Authentication → Users → Add user**
2. Enter your email and a strong password. Click **Create user**.
3. Copy the user UUID from the users list.
4. Open SQL Editor and run:

```sql
INSERT INTO admin_users (user_id, is_active)
VALUES ('<paste-user-uuid-here>', true);
```

5. Visit `/admin/login` and sign in with your email/password.

For full details see [`docs/database.md`](docs/database.md).

---

## 11. Deployment

### Recommended: Cloudflare Pages

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `apps/web/dist` |
| Root directory | *(leave blank — uses monorepo root)* |

**Environment variables** (set in Pages dashboard → Settings → Environment variables):

```
VITE_SUPABASE_URL      = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = your-anon-key
VITE_APP_BASE_URL      = https://your-domain.com
```

**Client-side routing** — add `apps/web/public/_redirects`:

```
/* /index.html 200
```

### Alternative: Netlify / Vercel / GitHub Pages

All support the static `dist/` output with the same environment variable names.

For a full step-by-step guide see [`docs/deployment-guide.md`](docs/deployment-guide.md).

---

## 12. GitHub Actions scraper

The workflow at `.github/workflows/run-scrapers.yml` runs daily at **18:30 UTC** (midnight Sri Lanka time).

### Required GitHub secrets

In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |

### Running manually

1. Go to **Actions** tab → **Run Promotion Scrapers**
2. Click **Run workflow → Run workflow**

### First time: install Playwright Chromium

The CI workflow installs Playwright Chromium automatically (step 3b). After the first run it is cached (~500 MB). If you want to skip it (faster, but Sampath scraping may fail), comment out step 3b in the workflow file.

---

## 13. SEO and PWA

### SEO

- All public routes are **SSG pre-rendered** to static HTML at build time using `scripts/prerender.ts`
- Every page includes: `<title>`, `<meta name="description">`, `<link rel="canonical">`, Open Graph tags (`og:title`, `og:description`, `og:url`, `og:image`), Twitter Card tags
- **JSON-LD structured data**: `WebSite` on homepage, `schema.org/Offer` on offer detail pages, `BreadcrumbList` on bank/category/offer pages
- Sitemap generated at `dist/sitemap.xml` — submit to Google Search Console after deployment
- `robots.txt` allows all public pages, disallows `/admin` and `/my-cards`
- Set `VITE_APP_BASE_URL` to your production domain for correct canonical URLs

### OG image

A 1200×630 PNG at `apps/web/public/og-cover.png` is used as the default OG share image. Replace with your own branded image if needed.

### PWA

- Installable on Android and iOS (add to home screen)
- Service worker precaches all JS, CSS, HTML, and assets
- Supabase API responses cached (stale-while-revalidate, 24 h)
- Offline fallback: `public/offline.html` shown for uncached navigation requests
- Admin routes excluded from offline fallback

---

## 14. Security notes

- The **anon key** is safe to expose in frontend code — Supabase RLS restricts what it can read
- The **service role key** bypasses RLS. It must **never** appear in frontend code or git history
- RLS policies ensure: public users can only read `approved + active + non-expired` offers
- Scraping tables (`scrape_sources`, `scrape_runs`, `scraped_offer_candidates`) are admin-only
- Admin access is controlled by the `admin_users` table (not just by Supabase Auth)
- No sensitive card data (card number, CVV, PIN, NIC) is ever collected — only bank name, card type, and network
- `.env` files are in `.gitignore` — verify before pushing

Full security checklist: [`docs/security-checklist.md`](docs/security-checklist.md)

---

## 15. Known limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Offer detail pages SSG shows loading state | OG tags for offers require JS | Google indexes via JS execution; Twitter/FB preview uses generic site title |
| Sampath Bank uses Cloudflare protection | Scraper may get blocked | `cloudscraper` + Playwright fallback. May need re-tuning if Cloudflare rules change. |
| No rate limiting on admin API calls | Internal risk only | RLS prevents public abuse |
| Sitemap reflects build-time data | New offers post-deploy not in sitemap | Re-deploy or set up a cron deploy trigger |
| No email notifications for new candidates | Admin must check manually | Supabase Webhooks or pg_notify could trigger email |

---

## 16. Future roadmap

- [ ] BOC, People's Bank, and NDB scrapers
- [ ] Push notifications for new offers matching saved cards (Web Push API)
- [ ] Offer expiry email digest for subscribers
- [ ] Multi-country support (India, Singapore, UAE — schema already has `country_code`)
- [ ] Merchant logo images
- [ ] Offer comparison view
- [ ] Google Search Console sitemap submission automation
- [ ] Incremental static regeneration (ISR) to avoid full rebuilds for new offers

---

## Privacy

CardPromo LK never asks for card numbers, CVV, expiry dates, NIC, or phone numbers.
Only non-sensitive identifiers (bank name, card type, network) are stored locally in your browser.
The service role key is only used server-side and never exposed in frontend code.

## Disclaimer

Promotion information is collected from public sources and may change without notice.
Please verify offer details with the relevant bank or merchant before making a purchase.

---

© 2026 CardPromo LK
