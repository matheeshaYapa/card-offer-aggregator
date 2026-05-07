# CardPromo LK — Security Checklist

This document describes the security decisions made in CardPromo LK and provides a verification checklist before going to production.

---

## Key security model

```
Public user (no auth)
  │ anon key only
  ▼
Supabase RLS → approved + active + non-expired offers only
               banks, categories, merchants (read-only)
               NO access to: scrape data, admin_users, draft/rejected offers

Admin user (Supabase Auth session)
  │ anon key + JWT session
  ▼
Supabase RLS → full CRUD on all tables (via is_admin() check)
               is_admin() = exists in admin_users table AND is_active = true

Scraper (GitHub Actions)
  │ service role key (bypasses RLS)
  ▼
Full insert access to scrape_runs + scraped_offer_candidates
No DELETE capability by design (candidates are audit trail)
```

---

## Checklist

### Keys and secrets

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **not** in `apps/web/.env.local` or `apps/web/.env.example`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **not** committed to git history
  - Verify: `git log --all --full-history -- "**/*.env"` returns nothing with real keys
  - Verify: `git grep -r "service_role"` shows only placeholder values
- [ ] `VITE_SUPABASE_ANON_KEY` in frontend is the **anon/public** key only (not the service role key)
  - The anon key starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` and is safe to expose
- [ ] Service role key stored in GitHub Actions secrets (not plaintext in workflow YAML)
- [ ] `.env` and `.env.local` files are listed in `.gitignore`

### Row Level Security

- [ ] RLS is enabled on **all** tables in Supabase
  - Dashboard → Database → Tables → each table should show "RLS enabled"
  - Or run: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
  - All rows should have `rowsecurity = true`

- [ ] Anonymous users can only read:
  - `offers` where `status = 'approved' AND is_active = true AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)`
  - `banks`, `categories`, `merchants`, `cards` where `is_active = true`
  - `offer_bank_rules`, `offer_cards` (related to visible offers only — enforced by join)

- [ ] Anonymous users **cannot** read:
  - `scraped_offer_candidates` (any row)
  - `scrape_runs`, `scrape_sources`
  - `admin_users`
  - Offers with `status = 'draft'`, `'pending_review'`, or `'rejected'`

- [ ] Test anon access in Supabase SQL editor (simulating anon role):
  ```sql
  SET LOCAL role TO anon;
  SELECT count(*) FROM scraped_offer_candidates;  -- should return 0 or error
  SELECT count(*) FROM offers WHERE status = 'draft';  -- should return 0
  ```

### Admin access

- [ ] Admin access is controlled by the `admin_users` table, **not** solely by Supabase Auth
  - A Supabase Auth user without an `admin_users` row cannot access admin data
  - The `is_admin()` function checks BOTH `auth.uid()` match AND `is_active = true`

- [ ] `ProtectedRoute` component in the frontend redirects unauthenticated users to `/admin/login`
  - **Note:** This is UX-only. The real security boundary is RLS.

- [ ] Admin users can be deactivated by setting `is_active = false` in `admin_users` table (no need to delete Supabase Auth user)

### Sensitive data

- [ ] The app **never** asks for or stores: card numbers, CVV, expiry date, NIC, passport number, bank PINs, phone numbers
- [ ] `localStorage` only contains: bank name, card type (credit/debit), network (Visa/Mastercard/etc.) — no account-identifying information
- [ ] The `source_url` for every scraped offer is retained so users can verify with the bank directly

### Frontend security

- [ ] Admin routes (`/admin/*`) are never included in `robots.txt` Allow list
  - Verify: `apps/web/public/robots.txt` has `Disallow: /admin`
- [ ] Admin JS chunks are lazy-loaded — not included in the public bundle
  - Verify: `npm run build:client` output shows `AdminBanksPage-*.js`, `AdminLoginPage-*.js` etc. as separate chunks
- [ ] No server-side secrets in `index.html`, prerendered HTML, or JS bundles
  - Verify: `grep -r "service_role" apps/web/dist/` should return nothing

### Scraper security

- [ ] Scraper only runs via GitHub Actions with secrets injected at runtime
- [ ] The scraper only **inserts** into `scraped_offer_candidates` — it cannot approve or publish offers
- [ ] Candidates never auto-publish — status starts as `pending` and requires manual admin approval
- [ ] The `candidate_hash` UNIQUE constraint prevents duplicate insertions

### Build and deployment

- [ ] `VITE_SUPABASE_ANON_KEY` is set as a **non-secret** environment variable in Cloudflare Pages (it will be bundled into the JS anyway)
- [ ] `VITE_APP_BASE_URL` is set to your production domain (affects canonical URLs and OG tags)
- [ ] Cloudflare Pages Build → confirm no secrets appear in build logs

---

## What Supabase RLS does NOT protect against

| Scenario | Risk level | Notes |
|---|---|---|
| An admin user going rogue | Medium | Admins have full CRUD. Audit trail: `scrape_runs`, `scraped_offer_candidates` provide history. |
| Supabase itself being breached | Low | Supabase encrypts at rest. Service role key rotation mitigates exposure. |
| Anon key being used in scripts | Very low | The anon key can only read approved public data per RLS. No harm if discovered. |
| DDOS against Supabase | Low | Supabase has DDoS protection. The static CDN (Cloudflare Pages) serves most traffic without hitting Supabase. |

---

## Incident response

**If the service role key is exposed (e.g. accidentally committed):**
1. Immediately go to Supabase → Project Settings → API → Regenerate service_role key
2. Update `scrapers/.env` locally
3. Update the `SUPABASE_SERVICE_ROLE_KEY` secret in GitHub Actions
4. Remove the exposed key from git history using `git filter-repo` or contact GitHub support
5. Audit `scraped_offer_candidates` for unexpected rows

**If an admin account is compromised:**
1. Set `is_active = false` in `admin_users` for that user_id
2. Disable the Supabase Auth user (Dashboard → Authentication → Users → Disable)
3. Audit recent offer changes in the `offers` table (`updated_at` timestamps)
