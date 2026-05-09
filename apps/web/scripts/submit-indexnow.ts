/**
 * Submits all sitemap URLs to IndexNow after a production deployment.
 *
 * IndexNow notifies Bing (and partner search engines) immediately when
 * content changes, instead of waiting for their regular crawl schedule.
 *
 * Usage:
 *   INDEXNOW_KEY=your-key tsx scripts/submit-indexnow.ts
 *
 * In CI this is called automatically by the deploy workflow.
 * The key file must already be hosted at:
 *   https://<host>/<key>.txt
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Load .env.local for local runs
const envLocal = path.resolve(root, '.env.local')
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const KEY      = process.env.INDEXNOW_KEY
const SITE_URL = (process.env.VITE_APP_BASE_URL ?? 'https://card-promo.com').replace(/\/$/, '')
const HOST     = new URL(SITE_URL).hostname   // e.g. card-promo.com

if (!KEY) {
  console.error('❌  INDEXNOW_KEY env var is not set. Skipping IndexNow submission.')
  process.exit(0)   // non-fatal — don't break the build
}

// ── Collect URLs from the sitemap ─────────────────────────────────────────────
const sitemapPath = path.resolve(root, 'dist/sitemap.xml')
let urls: string[] = []

if (fs.existsSync(sitemapPath)) {
  const sitemap = fs.readFileSync(sitemapPath, 'utf-8')
  const matches = sitemap.match(/<loc>(.*?)<\/loc>/g) ?? []
  urls = matches
    .map((m) => m.replace(/<\/?loc>/g, '').trim())
    .filter((u) => !u.includes('/my-cards'))   // /my-cards is noindex
} else {
  // Fallback: submit just the homepage
  urls = [SITE_URL + '/']
}

if (urls.length === 0) {
  console.log('ℹ️  No URLs found in sitemap. Skipping.')
  process.exit(0)
}

// ── Submit to IndexNow ────────────────────────────────────────────────────────
const payload = {
  host:        HOST,
  key:         KEY,
  keyLocation: `${SITE_URL}/${KEY}.txt`,
  urlList:     urls,
}

console.log(`📡  Submitting ${urls.length} URLs to IndexNow (host: ${HOST}) …`)

const response = await fetch('https://api.indexnow.org/IndexNow', {
  method:  'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body:    JSON.stringify(payload),
})

if (response.ok) {
  console.log(`✅  IndexNow accepted ${urls.length} URLs (HTTP ${response.status})`)
} else {
  const body = await response.text().catch(() => '')
  console.error(`❌  IndexNow returned HTTP ${response.status}: ${body}`)
  // Non-fatal — don't fail the build over a submission hiccup
}
