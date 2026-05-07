# CardPromo LK — Scraper

Python scraping pipeline that extracts credit/debit card promotions from
Sri Lankan bank websites and saves them as reviewable candidates in Supabase.

**Important:** Scraped candidates are never auto-published. An admin must
review and approve each one via the admin panel before it appears publicly.

---

## Architecture

```
main.py
  → loads scrape_sources from Supabase (or YAML fallback)
  → for each source:
      creates scrape_run (status = running)
      fetches HTML with requests
      parses with BeautifulSoup
      extracts: title, discount, valid dates, merchant
      generates candidate_hash (SHA-256 deduplication)
      inserts new scraped_offer_candidates (skips duplicates)
      updates scrape_run (status = success / failed)
      updates scrape_sources.last_scraped_at

Admin reviews → approves → new Offer record created
```

---

## Local setup

### 1. Create virtual environment

```bash
cd scrapers
python -m venv .venv

# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> **Playwright note:** `playwright` is listed in `requirements.txt` for
> future use with JavaScript-heavy pages. Current scrapers use `requests`
> only. To enable Playwright rendering when you need it, run:
> `python -m playwright install --with-deps chromium`

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

> The service role key bypasses Supabase RLS. **Never** commit it to git
> or expose it in frontend code. Store it only in `.env` locally and as a
> GitHub Actions secret in production.

### 4. Run locally

```bash
cd scrapers
python main.py
```

The scraper will:
1. Connect to Supabase using the service role key
2. Load active scrape sources from the `scrape_sources` table
   (falls back to `config/sources.yaml` if the DB is unavailable)
3. Run each scraper, save candidates, log a summary

Check results: **Admin panel → Review Candidates**

---

## GitHub Actions (automated daily scraping)

The workflow file is at `.github/workflows/run-scrapers.yml`.

### How it runs

| Trigger | When |
|---|---|
| Scheduled cron | Daily at **18:30 UTC** (midnight Sri Lanka time, UTC+5:30) |
| Manual dispatch | On-demand via the Actions tab |

### Setting up GitHub secrets

You must add two secrets before the workflow can run:

1. Go to your GitHub repository
2. **Settings → Secrets and variables → Actions**
3. Click **"New repository secret"** for each:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase → Project Settings → API |

> **Never** commit these values. They are injected securely by GitHub at runtime.

### Running the workflow manually

1. Go to your GitHub repository
2. Click the **Actions** tab
3. Select **"Run Promotion Scrapers"** in the left sidebar
4. Click **"Run workflow"** → **"Run workflow"** (confirm)
5. Watch the live logs in the run page

### Checking results after a run

- **GitHub Actions run log:** Repository → Actions → latest "Run Promotion Scrapers" run
- **Supabase table:** `scraped_offer_candidates` — new rows with `status = pending`
- **Admin panel:** `/admin/scraped-candidates` — review, approve, or reject

### Temporarily disabling the schedule

To pause the daily cron without deleting the workflow file, open
`.github/workflows/run-scrapers.yml` and comment out the `schedule:` block:

```yaml
on:
  # schedule:          ← comment this out
  #   - cron: "30 18 * * *"
  workflow_dispatch:   ← manual trigger still works
```

Commit the change and push. The cron will be inactive until you uncomment it.

### Adjusting the schedule

Edit the cron expression in the workflow file:

```yaml
- cron: "30 18 * * *"   # 18:30 UTC daily
```

[Crontab.guru](https://crontab.guru/) is a useful tool for crafting cron expressions.
Note: GitHub Actions cron runs in UTC.

---

## Duplicate detection

Each candidate is hashed using SHA-256 of:

```
source_url + normalized_title + normalized_discount + valid_to_date
```

The `candidate_hash` column has a `UNIQUE` constraint in PostgreSQL.
Re-running the scraper will silently skip already-seen candidates — safe
to run daily without creating duplicate records.

---

## How candidates flow to the public site

```
Scraper → scraped_offer_candidates (status = pending)
               ↓
           Admin reviews at /admin/scraped-candidates
               ↓  Click "Approve as Offer"
           New offer created (source_type = 'scraped', status = 'pending_review')
               ↓  Admin changes status to 'approved'
           Visible to public users on the site
```

Candidates are **never deleted** — they remain as an audit trail.

---

## Adding a new bank scraper

1. Create `src/scrapers/yourbank_scraper.py` extending `BaseScraper`
2. Override `parse(html)` with bank-specific CSS selectors
3. Register the bank in `SCRAPER_MAP` in `main.py`
4. Insert a row into `scrape_sources` in Supabase with the correct `bank_id`

---

## Ethical scraping guidelines

- Only scrape **public** bank promotion pages (no login required)
- Do **not** bypass access controls or scrape private/authenticated content
- Keep frequency low — daily cron is sufficient
- Always preserve and display `source_url` so users can verify with the bank
- Do **not** auto-publish scraped content — human review is mandatory
- Check each bank's `robots.txt` and terms of service before scraping

---

## Project structure

```
scrapers/
├── main.py                         Entry point / orchestrator
├── requirements.txt
├── .env.example                    Copy to .env and fill in secrets
├── config/
│   └── sources.yaml                Fallback source config (no DB needed)
└── src/
    ├── db/
    │   └── supabase_client.py      Supabase connection + DB operations
    ├── models/
    │   └── scraped_offer.py        Pydantic model for a candidate
    ├── scrapers/
    │   ├── base_scraper.py         Abstract base + GenericScraper fallback
    │   ├── hnb_scraper.py          HNB
    │   ├── commercial_bank_scraper.py  ComBank
    │   └── sampath_scraper.py      Sampath
    ├── extractors/
    │   ├── date_extractor.py       Regex-based date detection
    │   ├── discount_extractor.py   Discount pattern matching
    │   └── merchant_extractor.py   Merchant keyword lookup
    └── utils/
        ├── hashing.py              SHA-256 candidate hash generation
        ├── text_cleaner.py         Text normalization
        └── logger.py               Structured logging
```
