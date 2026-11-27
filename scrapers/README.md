# CardPromo LK — Scraper

Python scraping pipeline that extracts credit/debit card promotions from Sri Lankan bank websites and saves them as reviewable candidates in Supabase.

The scraper auto-publishes candidates with a score of at least 0.80, a bank-owned HTTPS source, a usable title and benefit, and a valid end date. Candidates with incomplete evidence stay in the admin review queue. Publication saves the offer and its bank rules together.

Run `python main.py --audit` for a read-only source check, or add `--bank hnb` to check one bank. Audits use `config/sources.yaml` and require no database credentials. See the [coverage audit and release steps](../docs/source-coverage.md).

---

## Requirements

- Python 3.11+
- A Supabase project with migrations applied (see root `README.md §10`)
- `SUPABASE_SERVICE_ROLE_KEY` from Supabase → Project Settings → API

---

## Local setup

### Step 1 — Create a virtual environment

**Windows PowerShell:**
```powershell
cd scrapers
python -m venv .venv
.venv\Scripts\Activate.ps1
```

> If you get a `cannot be loaded because running scripts is disabled` error, run:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

**macOS / Linux (bash / zsh):**
```bash
cd scrapers
python3 -m venv .venv
source .venv/bin/activate
```

After activation your prompt shows `(.venv)`.

To deactivate later: `deactivate`

---

### Step 2 — Install dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `requests`, `beautifulsoup4`, `lxml` — HTML fetching and parsing
- `playwright` — headless browser for JavaScript-heavy pages (Sampath)
- `cloudscraper` — Cloudflare bypass for Sampath Bank
- `pydantic` — data validation
- `python-dotenv` — `.env` file loading
- `supabase` — Supabase Python client
- `PyYAML` — fallback config file parsing
- `python-dateutil` — flexible date parsing

---

### Step 3 — Install Playwright Chromium (for Sampath)

Sampath Bank is behind Cloudflare bot protection. The scraper first tries `cloudscraper` (lightweight), and falls back to Playwright's headless Chromium if the page is a JavaScript SPA:

```bash
python -m playwright install --with-deps chromium
```

This downloads ~500 MB of Chromium. You only need to do this once per machine. If you don't install it, the scraper logs a warning and skips Sampath — HNB and ComBank will still run.

---

### Step 4 — Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

The service role key bypasses Supabase RLS. **Never commit it to git.**

---

### Step 5 — Run locally

```bash
# Make sure .venv is activated and you are inside scrapers/
python main.py
```

The scraper will:
1. Connect to Supabase using the service role key
2. Load active scrape sources from the `scrape_sources` table
3. Run each bank's scraper
4. Save new candidates and publish those that pass the checks
5. Record extracted totals and mark empty or incomplete sources as failed or partial

Expected console output:
```
============================================================
CardPromo LK Scraper starting
============================================================

→ Source: HNB Card Offers (https://www.hnb.lk/card-promotion)
  HNB: API-based scraper → https://venus.hnb.lk/api/get_all_web_card_promos
  HNB: fetched 743 raw offer(s) from API
  HNB: produced 743 unique candidate(s)
  ✓ 743 new | 0 duplicate(s) skipped

→ Source: Commercial Bank Promotions (https://www.combank.lk/rewards-promotions)
  ComBank: found 54 unique offer link(s) via href pattern
  ComBank: extracted 54 candidate(s)
  ✓ 54 new | 0 duplicate(s) skipped

→ Source: Sampath Bank Promotions (...)
  Sampath: fetching ... via cloudscraper
  ...

============================================================
Done. New candidates: 797 | Duplicates skipped: 0
============================================================
```

---

## Checking results

After running, review candidates at:
- **Admin panel** → `/admin/scraped-candidates`
- **Supabase table** → `scraped_offer_candidates` (filter `status = 'pending'`)

---

## Duplicate detection

Each candidate gets a SHA-256 hash of:
```
source_url + normalized_title + normalized_discount + valid_to_date
```

The `candidate_hash` column has a `UNIQUE` constraint in PostgreSQL. Re-running the scraper skips already-seen candidates silently — safe to run daily without creating duplicate records.

---

## Categories and confidence

After a source is parsed, `src/confidence.py` re-checks every candidate as a
batch before anything is saved:

1. **Category**: `src/extractors/category_extractor.py` assigns a category slug
   from the bank's own label (`Category: X` in `raw_text`) or, failing that,
   weighted keywords and known merchants in `config/category_rules.json`.
   Tune that file (not the code) when an offer lands in the wrong category,
   and add a case to `tests/test_category_extractor.py`.
2. **Confidence**: the parser's own score (`parser_score`, how complete the
   extraction was) is multiplied down for each failed check. The checks are:
   placeholder or page-heading titles, a benefit that contradicts the bank's
   text or has no value, end dates more than ~18 months away, one title shared
   by several offers, run-together names and missing merchant or category.
   Boilerplate descriptions shared across a page are dropped.
3. **Hard checks** block auto-publishing whatever the score. If most of a
   source's offers fail hard checks, the parser has probably broken (the bank
   changed its page), so the whole batch is held and the run marked `partial`.
   A run whose offer count halves since the last success is also marked `partial`.

Every flag is stored on the candidate (`quality_flags`) and shown in the admin
review screen.

```bash
python main.py --audit --bank sampath-bank --verbose   # every offer with score, category, blockers
python -m pytest tests                                 # classifier + scorer tests
python backfill_categories.py [--apply]                # categorise existing offers (dry run by default)
python calibrate_confidence.py                         # score vs. admin approve/reject decisions
```

Run `calibrate_confidence.py` after a few weeks of reviews: it shows the
precision auto-publishing would have at each threshold and which flags predict
rejection, so `AUTO_PUBLISH_THRESHOLD` (`src/scrape_quality.py`) and `PENALTIES`
(`src/confidence.py`) can be set from data rather than guesswork.

---

## Architecture

### Scraper map (`main.py`)

```python
SCRAPER_MAP = {
    'hnb': HNBScraper,
    'commercial-bank': CommercialBankScraper,
    'sampath-bank': SampathScraper,
}
```

### Per-bank strategy

| Bank | Method | Detail |
|---|---|---|
| HNB | JSON API | Calls `venus.hnb.lk/api/get_all_web_card_promos?page={n}&cardType=All`. ~75 pages × 10 = ~743 offers. No HTML parsing needed. |
| Commercial Bank | HTML (server-rendered) | Selects `<a href="/rewards-promotion/[category]/[slug]">` links. Extracts h3 title, discount text, validity from each link. |
| Sampath Bank | Playwright + JSON API | Angular SPA, Cloudflare domain-wide blocks plain requests. API discovered (2026-05-07): `GET /api/card-promotions?category={cat}&page_number={n}&size={size}`. Playwright loads the main page first (solves CF challenge), then calls the API via `page.evaluate()` which runs inside the browser context and inherits the CF clearance cookies. |

### Candidate flow

```
Scraper → assess_batch (category + confidence + quality flags)
        → scraped_offer_candidates (status = pending)
              ├─ score ≥ 0.80 and no hard flags → publish_scraped_candidate() → live offer (with category)
              ↓ otherwise: Admin reviews at /admin/scraped-candidates
          Click "Approve as Offer"
              ↓ ApproveAsOfferModal (pre-filled form)
          New offer created (status = pending_review)
              ↓ Admin sets status = approved
          Visible publicly
```

Candidates are **never deleted** — they remain as an audit trail.

---

## Adding a new bank scraper

1. Create `src/scrapers/yourbank_scraper.py` extending `BaseScraper`:
   ```python
   from src.scrapers.base_scraper import BaseScraper
   from src.models.scraped_offer import ScrapedOffer

   class YourBankScraper(BaseScraper):
       def parse(self, html: str) -> list[ScrapedOffer]:
           ...
   ```
2. Override `parse()` with bank-specific logic (CSS selectors, API calls, etc.)
3. Optionally override `run()` if you need to fetch from multiple URLs
4. Register in `SCRAPER_MAP` in `main.py`:
   ```python
   from src.scrapers.yourbank_scraper import YourBankScraper
   SCRAPER_MAP['your-bank-slug'] = YourBankScraper
   ```
5. Insert a row into `scrape_sources` in Supabase:
   ```sql
   INSERT INTO scrape_sources (bank_id, name, source_url, source_type, is_active)
   VALUES ('<bank-uuid>', 'Your Bank Promotions', 'https://...', 'html', true);
   ```

---

## Common errors and fixes

### `ModuleNotFoundError: No module named 'supabase'`

The virtual environment is not activated, or `pip install -r requirements.txt` was not run.

```bash
source .venv/bin/activate      # macOS/Linux
.venv\Scripts\Activate.ps1     # Windows PowerShell
pip install -r requirements.txt
```

### `python: command not found` (Windows)

Windows App Execution Aliases can shadow `python`. Use the full path:

```powershell
& "C:\Users\YourName\AppData\Local\Programs\Python\Python311\python.exe" main.py
```

Or use `python3` if that's what resolves on your system.

### `Error: Missing required GitHub secrets` (CI)

`SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is not set in GitHub repo secrets.
Go to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

### Sampath returns 0 candidates

Sampath uses Cloudflare domain-wide — plain `requests` and `cloudscraper` are both blocked. The scraper now uses Playwright with the JSON API (`/api/card-promotions`).

**Check:**
1. Playwright Chromium is installed: `python -m playwright install --with-deps chromium`
2. The scraper log shows "main page loaded OK — CF challenge passed" → then API calls work
3. If the log shows "failed to load main page", Cloudflare may have tightened their bot rules — see next section

**If Playwright is still blocked by Cloudflare:**
The headless browser may be detected. Try installing `playwright-stealth`:
```bash
pip install playwright-stealth
```
Then add to `sampath_scraper.py` inside `run()` after `page = context.new_page()`:
```python
try:
    from playwright_stealth import stealth_sync
    stealth_sync(page)
except ImportError:
    pass
```

### `playwright._impl._api_types.Error: Executable doesn't exist`

Playwright is installed but Chromium browser binary is not. Run:
```bash
python -m playwright install --with-deps chromium
```

### `supabase.exceptions.APIError: JWT expired`

Your `.env` has an outdated `SUPABASE_SERVICE_ROLE_KEY`. Regenerate it in Supabase → Project Settings → API.

### Candidate hash collision (duplicate silently skipped)

This is expected behaviour — the same offer scraped on a different day will be skipped if the title, discount, and end date haven't changed. This is by design to prevent the admin from reviewing the same offer repeatedly.

---

## Project structure

```
scrapers/
├── main.py                    Orchestrator entry point
├── requirements.txt           Python dependencies
├── .env.example               Copy → .env, fill in secrets
├── config/
│   └── sources.yaml           Fallback source config (no DB needed)
└── src/
    ├── db/
    │   └── supabase_client.py  Supabase connection + all DB operations
    ├── models/
    │   └── scraped_offer.py    Pydantic model for a scraper output
    ├── scrapers/
    │   ├── base_scraper.py     Abstract base + GenericScraper fallback
    │   ├── hnb_scraper.py      HNB (API-based)
    │   ├── commercial_bank_scraper.py  ComBank (HTML)
    │   └── sampath_scraper.py  Sampath (cloudscraper + Playwright)
    ├── extractors/
    │   ├── date_extractor.py   Regex-based date detection for Sri Lankan date formats
    │   ├── discount_extractor.py  Discount percentage/amount pattern matching
    │   └── merchant_extractor.py  Merchant keyword lookup from title
    └── utils/
        ├── hashing.py          SHA-256 candidate_hash generation
        ├── text_cleaner.py     Unicode normalization and text cleaning
        └── logger.py           Structured logging setup
```

---

## Ethical scraping guidelines

- Only scrape **public** bank promotion pages (no login required)
- Do **not** bypass access controls or scrape private/authenticated content
- Keep frequency low — daily cron is sufficient; do not run more than once per day
- Always preserve and display `source_url` so users can verify with the bank
- Keep incomplete or ambiguous candidates in the admin review queue
- Check each bank's `robots.txt` and terms of service before adding a new source
