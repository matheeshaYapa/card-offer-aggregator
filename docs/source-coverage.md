# CardPromo LK source coverage

## Production snapshot on 27 November 2026

The public database returned 520 approved, active offers with end dates on or after the audit date, including offers with no listed end date. Fourteen had future start dates. The redesigned catalog displayed 506 currently available offers.

| Bank | Currently available in public catalog | Read-only source check |
| --- | ---: | --- |
| Amana Bank | 16 | Extracted 105 candidates from the Visa debit listing. |
| Bank of Ceylon | 4 | Extracted 67 candidates from bank offer pages. |
| Commercial Bank | 63 | Extracted 78 candidates from the rewards listing. |
| HNB | 49 | Extracted 1,044 unique candidates from the public API. |
| Nations Trust Bank | 71 | Extracted 361 candidates before the parser repair. The updated parser recovered merchant, benefit and validity from three sampled official offer pages. |
| NDB | 12 | One run extracted 119 candidates. Subsequent requests returned an Incapsula access-denial page. |
| People's Bank | 27 | A clean run extracted 395 candidates from the credit-card categories. An earlier run skipped two unavailable categories. |
| Sampath Bank | 195 | The public API reported positive totals and returned empty candidate arrays across all 12 categories tested. |
| Seylan Bank | 56 | Extracted 386 candidates. Removed stray template text from offer titles. |
| Standard Chartered | 0 | Legacy promotion page returned 404. DFCC took over the Sri Lankan retail card portfolio. |
| Union Bank | 0 | The scraper received an Incapsula access-denial page with HTTP 200. |
| DFCC | 0 | New online and hotel feed parser extracted 42 candidates. Twenty-five met the auto-publication checks. |

All 520 public records lacked a category, and 507 had a bank rule with both card type and network unset. Thirteen currently available offers lacked any issuer rule. Each had one exact unlinked candidate match by title, source URL and end date. The migration recovers issuer links for unambiguous pending matches and backfills categories and card types where the source supplies evidence.

Sources for the issuer transition and new feed are the [DFCC customer transition notice](https://www.dfcc.lk/welcome), [DFCC online promotions](https://www.dfcc.lk/en/dfcc-card-offers/online-promotion), and [DFCC hotel promotions](https://www.dfcc.lk/dfcc-cards/hotels-promotions).

## Release and verification

1. Apply [migration 009](../supabase/migrations/009_scraped_offer_quality.sql) in Supabase before releasing the scraper. It backfills known categories and eligibility, registers DFCC, and adds the atomic publisher used by the new job.
2. Release the frontend and scraper updates through the existing GitHub and Cloudflare Pages deployment.
3. Re-enable **Run Promotion Scrapers** in GitHub Actions and run it manually once. The workflow was in `disabled_inactivity` and the latest production run in Supabase was dated 3 September 2026. **Admin → Scrape Runs** now records extracted totals and flags empty or partial sources.
4. Check newly published rows on the public bank and category pages. Run `npm run verify:offer-ssr -- https://card-promo.com`. The live site currently serves the SPA fallback for missing offer URLs and omits a self-referential canonical on the real offer tested. Verify the Pages deployment includes the repository's `functions/` directory and has the two Supabase runtime variables configured.

Run a read-only audit from `scrapers/` with `python main.py --audit` or use `--audit --bank hnb` to check one source. An audit uses the committed registry and never writes to Supabase. Candidate counts measure extraction coverage. Publication checks determine which candidates can be approved automatically, and representative spot checks are still needed to measure accuracy.
