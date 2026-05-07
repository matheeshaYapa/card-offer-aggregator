# CardPromo LK — Manual Setup Checklist

These are the one-time manual tasks required to go from a fresh clone to a fully running production deployment. Check each item off as you complete it.

---

## Phase 1 — Supabase project

- [ ] **Create a Supabase project**
  - Go to [supabase.com](https://supabase.com) → New project
  - Choose a region close to Sri Lanka (e.g. Singapore `ap-southeast-1`)
  - Set a strong database password — save it securely

- [ ] **Copy project URL**
  - Supabase Dashboard → Project Settings → API
  - Copy **Project URL** (e.g. `https://abcdef.supabase.co`)
  - Add to `apps/web/.env.local` as `VITE_SUPABASE_URL`
  - Add to `scrapers/.env` as `SUPABASE_URL`

- [ ] **Copy anon/public key**
  - Same API page → **anon / public** key
  - Add to `apps/web/.env.local` as `VITE_SUPABASE_ANON_KEY`
  - This key is safe to expose in frontend code (RLS restricts what it can access)

- [ ] **Copy service role key — handle with care**
  - Same API page → **service_role** key
  - Add to `scrapers/.env` as `SUPABASE_SERVICE_ROLE_KEY`
  - **Never add this to `apps/web/.env.local` or any frontend file**
  - Never commit this key to git
  - Store it in a password manager

---

## Phase 2 — Run Supabase migrations

- [ ] **Run migration 001** — Initial schema (12 tables)
  - Supabase Dashboard → SQL Editor → New query
  - Paste content of `supabase/migrations/001_initial_schema.sql`
  - Click **Run**

- [ ] **Run migration 002** — RLS policies
  - New query → paste `supabase/migrations/002_rls_policies.sql` → Run

- [ ] **Run migration 003** — Seed data
  - New query → paste `supabase/migrations/003_seed_base_data.sql` → Run
  - This creates 5 banks, 10 cards, 5 categories, 12 merchants, 3 scrape sources, 8 sample offers

- [ ] **Verify RLS is enabled**
  - Supabase Dashboard → Database → Tables
  - Confirm each table shows "RLS enabled"
  - Spot-check: `offers` table should show a `public_read_approved_offers` policy

---

## Phase 3 — Create the first admin user

- [ ] **Create user in Supabase Auth**
  - Dashboard → Authentication → Users → Add user
  - Enter your email address and a strong password
  - Click **Create user**

- [ ] **Copy the user UUID**
  - In the users list, click your new user
  - Copy the UUID from the top (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

- [ ] **Grant admin access**
  - SQL Editor → New query:
  ```sql
  INSERT INTO admin_users (user_id, is_active)
  VALUES ('<paste-uuid-here>', true);
  ```
  - Run the query

- [ ] **Test admin login**
  - Run `npm run dev` (or visit your deployed URL)
  - Go to `/admin/login`
  - Sign in with the email/password you created
  - You should be redirected to `/admin/dashboard`

---

## Phase 4 — GitHub repository setup

- [ ] **Push code to GitHub**
  ```bash
  git init        # if not already a git repo
  git add .
  git commit -m "Initial commit: CardPromo LK"
  git remote add origin https://github.com/your-username/card-offer-aggregator.git
  git push -u origin main
  ```

- [ ] **Add GitHub Actions secret: SUPABASE_URL**
  - GitHub repo → Settings → Secrets and variables → Actions
  - Click **New repository secret**
  - Name: `SUPABASE_URL`
  - Value: your Supabase project URL

- [ ] **Add GitHub Actions secret: SUPABASE_SERVICE_ROLE_KEY**
  - Same page → New repository secret
  - Name: `SUPABASE_SERVICE_ROLE_KEY`
  - Value: your service role key

- [ ] **Trigger a manual scraper run**
  - GitHub → Actions tab → Run Promotion Scrapers
  - Click **Run workflow → Run workflow** (default branch)
  - Wait for it to complete (~3–5 minutes)
  - Check the workflow run log — look for "Done. New candidates: X"

- [ ] **Review scraped candidates**
  - Sign in to admin panel → Scraped Candidates
  - Review and approve interesting offers

---

## Phase 5 — Cloudflare Pages deployment

- [ ] **Create a Cloudflare Pages project**
  - [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create application → Pages
  - Connect to GitHub → select your repository → Begin setup

- [ ] **Configure build settings**
  - Framework preset: None
  - Build command: `npm run build`
  - Build output directory: `apps/web/dist`
  - Root directory: *(leave blank)*

- [ ] **Add environment variables**
  - Settings → Environment variables → Add variable (Production):
  - `VITE_SUPABASE_URL` = your Supabase URL
  - `VITE_SUPABASE_ANON_KEY` = your anon key
  - `VITE_APP_BASE_URL` = `https://your-domain.com` (or the `*.pages.dev` URL if no custom domain yet)

- [ ] **Deploy**
  - Trigger a deployment (push to main, or click Deploy in the Cloudflare dashboard)
  - Wait for build to complete

- [ ] **Test the deployed site**
  - Visit the `*.pages.dev` URL
  - Confirm offers load, `/admin/login` works, `/bank/hnb` has correct meta tags
  - Confirm `og:url` and `<link rel="canonical">` match your `VITE_APP_BASE_URL`

---

## Phase 6 — Custom domain (optional)

- [ ] **Add custom domain in Cloudflare Pages**
  - Pages project → Custom domains → Set up a custom domain
  - Enter your domain (e.g. `cardpromo.lk`)

- [ ] **Update DNS records**
  - Cloudflare will show you the CNAME record to add
  - If your domain is already on Cloudflare DNS, it's added automatically

- [ ] **Update VITE_APP_BASE_URL**
  - Pages → Settings → Environment variables → Edit `VITE_APP_BASE_URL`
  - Change to `https://cardpromo.lk`
  - Redeploy (push a commit or trigger manual deploy)

- [ ] **Update robots.txt Sitemap line**
  - `apps/web/public/robots.txt` already has: `Sitemap: https://cardpromo.lk/sitemap.xml`
  - If your domain is different, update this file

---

## Phase 7 — Google Search Console

- [ ] **Add property to Google Search Console**
  - [search.google.com/search-console](https://search.google.com/search-console)
  - Add property → URL prefix → enter `https://your-domain.com`
  - Verify ownership (HTML tag method: add to `apps/web/index.html` → `<meta name="google-site-verification" ...>`)

- [ ] **Submit sitemap**
  - Search Console → Sitemaps → Add a new sitemap
  - Enter: `https://your-domain.com/sitemap.xml`
  - Click Submit

- [ ] **Request indexing for key pages** (optional, speeds up initial indexing)
  - URL Inspection → enter homepage URL → Request indexing
  - Repeat for `/offers`, `/bank/hnb`, `/bank/commercial-bank`, etc.

---

## Phase 8 — Post-deployment verification

- [ ] **Check robots.txt is accessible**: `https://your-domain.com/robots.txt`
- [ ] **Check sitemap is accessible**: `https://your-domain.com/sitemap.xml`
- [ ] **Check offline page**: Disable network in Chrome DevTools → navigate to an uncached URL → should show `offline.html`
- [ ] **Test PWA install**: In Chrome on mobile, tap the "Add to Home Screen" prompt
- [ ] **Verify OG tags**: Paste a URL into [opengraph.xyz](https://www.opengraph.xyz) — check title, description, and og-cover.png image load
- [ ] **Verify admin is not indexed**: Visit `/admin` → should redirect to `/admin/login` and not be indexable (robots.txt has `Disallow: /admin`)
- [ ] **Check bank website terms**: Review the terms of service for each scraped bank before regular operation (see ethical scraping section in `scrapers/README.md`)

---

## Ongoing maintenance

- [ ] **Monitor scraper runs**: Check GitHub Actions once a week → look for failed runs
- [ ] **Review pending candidates**: Visit `/admin/scraped-candidates` regularly → approve or reject new offers
- [ ] **Redeploy after adding offers**: The sitemap and prerendered pages are built at deploy time — redeploy to pick up new offers in the sitemap
- [ ] **Rotate service role key periodically**: Supabase → Project Settings → API → Regenerate service role key → update GitHub secret
