# CardPromo LK — Frontend (`apps/web`)

React 19 + Vite 8 + Tailwind CSS v4 app. Serves both the public-facing promotions site and the admin panel.

---

## Prerequisites

- Node.js 20+
- npm 10+
- A running Supabase project with migrations applied (see root `README.md §10`)

---

## Setup

### 1. Install dependencies

Run from the **monorepo root** (not inside `apps/web`):

```bash
npm install
```

### 2. Configure environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` and fill in real values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_BASE_URL=http://localhost:5173
```

> Never add `SUPABASE_SERVICE_ROLE_KEY` here. It belongs only in `scrapers/.env` and GitHub Actions secrets.

---

## Commands

All commands can be run from the **monorepo root**:

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server at `http://localhost:5173` |
| `npm run build` | Full production build: client + SSR bundle + SSG prerender + sitemap |
| `npm run build:client` | Fast client-only build (no SSR/prerender — useful for quick checks) |
| `npm run preview` | Preview the built `dist/` at `http://localhost:4173` |
| `npm run typecheck` | TypeScript check (both `tsconfig.json` + `tsconfig.node.json`) |

Or run directly inside `apps/web/`:

```bash
cd apps/web
npm run dev
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (safe to expose in browser) |
| `VITE_APP_BASE_URL` | ✅ | Canonical base URL — used for `og:url`, `<link rel="canonical">`, sitemap. Use production domain in CI. |

---

## Build output

After `npm run build`:

```
apps/web/dist/
├── index.html              App shell
├── offers/index.html       Pre-rendered /offers
├── bank/*/index.html       Pre-rendered bank pages
├── category/*/index.html   Pre-rendered category pages
├── offer/*/index.html      Pre-rendered offer pages
├── sitemap.xml             Generated sitemap (uses VITE_APP_BASE_URL)
├── robots.txt              Copied from public/
├── offline.html            PWA offline fallback
├── og-cover.png            1200×630 OG share image
├── sw.js                   Workbox service worker
├── manifest.webmanifest    PWA manifest
└── assets/                 Hashed JS/CSS chunks
```

---

## Cloudflare Pages deployment settings

| Setting | Value |
|---|---|
| Framework preset | None (custom build) |
| Build command | `npm run build` |
| Output directory | `apps/web/dist` |
| Root directory | *(leave blank — monorepo root)* |
| Node.js version | 20 |

**Environment variables** (Pages dashboard → Settings → Environment variables):

```
VITE_SUPABASE_URL       = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY  = your-anon-key
VITE_APP_BASE_URL       = https://your-domain.com
```

**Client-side routing** — the file `apps/web/public/_redirects` must contain:
```
/* /index.html 200
```
This file is already present. Cloudflare Pages copies it to `dist/` automatically.

---

## Project structure

```
src/
├── app/App.tsx             All routes (public + admin)
├── components/
│   ├── admin/              Admin-specific components (layout, modals, forms)
│   ├── cards/              Card selector and list
│   ├── common/             Badge, EmptyState, etc.
│   ├── layout/             Header, Footer, BottomNav, PageContainer
│   ├── offers/             OfferCard, OfferGrid, OfferFilters
│   └── seo/                MetaTags, StructuredData
├── hooks/                  useSelectedCards, useOfferFilters, usePublicBrowseData, useAdminAuth
├── lib/supabase/           client.ts + queries/ (one file per entity)
├── pages/
│   ├── admin/              Admin CRUD pages + review pages
│   └── public/             HomePage, OffersPage, BankPage, CategoryPage, OfferDetailsPage
├── styles/global.css       Tailwind v4 @theme{} + .admin-* utility classes
├── types/                  index.ts (domain types), database.ts (DB enums)
└── utils/                  dateUtils, seo, normalization, offerMatching, slugUtils
```

---

## Key architectural notes

### SSG prerender + client-side hydration
`scripts/prerender.ts` builds static HTML for every public route at build time. Pages hydrate client-side from Supabase on first load. This gives fast initial paint (HTML from CDN) plus live data.

### react-helmet-async + React 19 SSR
React 19's `renderToString` does not populate `helmetContext` the same way as React 18. `entry-server.tsx` handles this with a two-pass extraction: meta/title/link tags are split from the front of the rendered HTML, and JSON-LD scripts are extracted from the body, then both are injected into `<head>` by `scripts/prerender.ts`.

### Admin lazy loading
All `/admin/*` components use `React.lazy()` + `<Suspense>`. They are code-split into separate chunks and never included in the public-facing bundle.

### Tailwind CSS v4
Uses the new CSS-first `@theme {}` configuration in `styles/global.css`. There is no `tailwind.config.js`. All design tokens (`--color-primary`, `--color-bg-base`, etc.) are defined there.
