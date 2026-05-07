# CardPromo LK — Deployment Guide

Step-by-step guide to deploying CardPromo LK to production.
For a full setup checklist (including Supabase and GitHub secrets) see `docs/manual-setup-checklist.md`.

---

## Overview of deployment components

| Component | Service | Notes |
|---|---|---|
| Frontend + admin panel | Cloudflare Pages | Static hosting, free tier |
| Database + Auth | Supabase | PostgreSQL, free tier |
| Scraper automation | GitHub Actions | Free for public repos; 2000 min/month for private |
| DNS (optional) | Cloudflare DNS | Free |

---

## 1. Supabase — production setup

### 1.1 Create project
- [app.supabase.com](https://app.supabase.com) → New project
- Name: `cardpromo-lk-prod`
- Region: Singapore (closest to Sri Lanka)
- Database password: generate a strong one, save in your password manager

### 1.2 Apply migrations

In Supabase SQL Editor, run each migration file in order:

```
supabase/migrations/001_initial_schema.sql   — 12 tables + indexes
supabase/migrations/002_rls_policies.sql     — RLS + is_admin() function
supabase/migrations/003_seed_base_data.sql   — Reference data + sample offers
```

### 1.3 Collect credentials

From **Project Settings → API**:

| Credential | Used for | Goes in |
|---|---|---|
| Project URL | All clients | `VITE_SUPABASE_URL` + `SUPABASE_URL` |
| anon / public key | Frontend | `VITE_SUPABASE_ANON_KEY` |
| service_role key | Scraper only | `SUPABASE_SERVICE_ROLE_KEY` |

### 1.4 Create admin user

```sql
-- 1. Go to Authentication → Users → Add user (enter email + password)
-- 2. Copy the UUID from the user list
-- 3. Run in SQL Editor:
INSERT INTO admin_users (user_id, is_active)
VALUES ('<paste-uuid>', true);
```

---

## 2. Cloudflare Pages — frontend deployment

### 2.1 Connect repository

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create application → Pages
2. Connect to GitHub → Authorize Cloudflare → Select your repo
3. Branch: `main`

### 2.2 Build settings

| Field | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `apps/web/dist` |
| Root directory | *(leave blank)* |

### 2.3 Environment variables

Click **Save and Deploy** is greyed out until you add env vars.

In **Settings → Environment variables → Add variable** (set for **Production**):

```
VITE_SUPABASE_URL      = https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY = your-anon-key
VITE_APP_BASE_URL      = https://your-domain.com
```

> Also add these for **Preview** deployments if you want branch previews to work (use the same values or a separate Supabase project for staging).

### 2.4 Deploy

Trigger the first deploy:
- Push a commit to `main`, or
- Cloudflare dashboard → Deployments → Create new deployment

Build takes ~2 minutes. After completion, your site is live at `https://your-project.pages.dev`.

### 2.5 Custom domain (optional)

1. Pages project → Custom domains → Set up a custom domain
2. Enter your domain (e.g. `cardpromo.lk`)
3. If the domain uses Cloudflare DNS: records are added automatically
4. If not on Cloudflare DNS: add the CNAME manually at your DNS provider

After the domain is live, update `VITE_APP_BASE_URL` to `https://cardpromo.lk` and redeploy.

### 2.6 Verify deployment

- Open your Pages URL (or custom domain)
- Check: `https://your-domain.com/robots.txt` is accessible
- Check: `https://your-domain.com/sitemap.xml` is accessible
- Check: `https://your-domain.com/offline.html` is accessible
- Check: Admin works at `https://your-domain.com/admin/login`
- Check: OG image at `https://your-domain.com/og-cover.png` is accessible

---

## 3. GitHub Actions — scraper setup

### 3.1 Add secrets

GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |

### 3.2 Trigger first scraper run

1. GitHub → Actions → **Run Promotion Scrapers**
2. Click **Run workflow → Run workflow**
3. Monitor the run — expect ~3–5 minutes
4. Check logs: look for `Done. New candidates: X`

### 3.3 Schedule

The workflow runs automatically at **18:30 UTC** (midnight Sri Lanka Standard Time, UTC+5:30) every day.

To change the time, edit `.github/workflows/run-scrapers.yml`:
```yaml
- cron: "30 18 * * *"   # HH:MM UTC
```
Use [crontab.guru](https://crontab.guru/) to craft cron expressions.

### 3.4 Playwright Chromium caching

Step 3b in the workflow installs Playwright Chromium (~500 MB). GitHub Actions caches this after the first install. Subsequent runs use the cache and skip the download (~2 min savings).

To disable Playwright (Sampath will be skipped): comment out step 3b in the workflow file.

---

## 4. Post-deployment checklist

### Functionality
- [ ] Homepage loads with offers from Supabase
- [ ] Bank page (`/bank/hnb`) loads and shows HNB offers
- [ ] Category page (`/category/dining`) works
- [ ] Offer detail page (`/offer/[slug]`) shows terms and eligibility
- [ ] My Cards page — add a card, verify the filter works on homepage
- [ ] Admin login at `/admin/login` works
- [ ] Admin can create/edit/approve an offer
- [ ] Scraper candidates appear at `/admin/scraped-candidates`

### SEO
- [ ] `view-source:https://your-domain.com` — verify `<title>`, `<meta name="description">`, `og:url`, JSON-LD are in `<head>`
- [ ] Google Rich Results Test: https://search.google.com/test/rich-results — paste your domain
- [ ] Twitter Card validator: https://cards-dev.twitter.com/validator
- [ ] Facebook Open Graph debugger: https://developers.facebook.com/tools/debug/
- [ ] Submit sitemap to Google Search Console

### PWA
- [ ] Chrome DevTools → Application → Service Workers — confirm SW is installed
- [ ] Chrome DevTools → Application → Manifest — confirm manifest loaded
- [ ] On a mobile device: visit the site → tap "Add to Home Screen" or browser install prompt

### Performance
- [ ] Run Lighthouse in Chrome DevTools → check Performance, SEO, Accessibility, PWA scores

---

## 5. Environment variables summary

### `apps/web/.env.local` (local development only — do NOT commit)

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_BASE_URL=http://localhost:5173
```

### Cloudflare Pages environment variables (production)

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_BASE_URL=https://your-domain.com
```

### `scrapers/.env` (local scraper — do NOT commit)

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### GitHub Actions secrets

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 6. Redeployment workflow

After making code changes:

```bash
git add .
git commit -m "Your change description"
git push origin main
```

Cloudflare Pages automatically deploys when you push to `main`. The build takes ~2 minutes.

**For content-only changes** (new offers via admin panel): a redeploy is needed to update the sitemap and prerendered pages. Either push a trivial commit or trigger a manual deploy in the Cloudflare dashboard.

---

## 7. Alternative hosting options

### Netlify

| Setting | Value |
|---|---|
| Base directory | *(blank)* |
| Build command | `npm run build` |
| Publish directory | `apps/web/dist` |

Add same 3 environment variables. Netlify redirects: add `apps/web/public/_redirects`.

### Vercel

| Setting | Value |
|---|---|
| Framework | Other |
| Root directory | *(blank)* |
| Build command | `npm run build` |
| Output directory | `apps/web/dist` |

Add same 3 environment variables. Vercel handles client-side routing automatically.

### GitHub Pages

1. Build locally with production env vars
2. Push `apps/web/dist` to `gh-pages` branch
3. Limitation: no custom `_redirects` — SPA routing may not work for direct URL access
