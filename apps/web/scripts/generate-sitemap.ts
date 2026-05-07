/**
 * Generates sitemap.xml after the production build.
 * When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are present, slugs are fetched
 * live from Supabase. Otherwise uses the seed slug fallbacks.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Load .env.local for local builds
const envLocalPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.env.local',
)
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, 'utf-8').split('\n')) {
    const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim()
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const toAbs = (p: string) => path.resolve(root, p)

const SITE_URL = process.env.VITE_APP_BASE_URL ?? 'https://cardpromo.lk'

// Seed fallbacks (mirrors 003_seed_base_data.sql)
let bankSlugs = ['commercial-bank', 'sampath-bank', 'hnb', 'boc', 'peoples-bank']
let categorySlugs = ['dining', 'shopping', 'travel', 'supermarket', 'electronics']
let offerSlugs = [
  'combank-20-off-selected-restaurants',
  'sampath-10-cashback-keells-super',
  'hnb-15-off-cinnamon-hotels',
  'boc-5-cashback-fuel',
  'sampath-12-off-abans',
  'hnb-bogo-hotel-buffet',
  'boc-0-installment-singer',
  'combank-5-cashback-cargills',
]

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (supabaseUrl && supabaseAnonKey) {
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(supabaseUrl, supabaseAnonKey)
  const today = new Date().toISOString().split('T')[0]

  const [{ data: banks }, { data: cats }, { data: offers }] = await Promise.all([
    client.from('banks').select('slug').eq('is_active', true),
    client.from('categories').select('slug').eq('is_active', true),
    client
      .from('offers')
      .select('slug')
      .eq('status', 'approved')
      .eq('is_active', true)
      .or(`valid_to.is.null,valid_to.gte.${today}`),
  ])

  if (banks) bankSlugs = banks.map((b: { slug: string }) => b.slug)
  if (cats) categorySlugs = cats.map((c: { slug: string }) => c.slug)
  if (offers) offerSlugs = offers.map((o: { slug: string }) => o.slug)
}

const today = new Date().toISOString().split('T')[0]

type SitemapUrl = { loc: string; changefreq: string; priority: string }

const urls: SitemapUrl[] = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/offers', changefreq: 'daily', priority: '0.9' },
  { loc: '/my-cards', changefreq: 'monthly', priority: '0.5' },
  ...bankSlugs.map((s) => ({ loc: `/bank/${s}`, changefreq: 'weekly', priority: '0.8' })),
  ...categorySlugs.map((s) => ({ loc: `/category/${s}`, changefreq: 'weekly', priority: '0.8' })),
  ...offerSlugs.map((s) => ({ loc: `/offer/${s}`, changefreq: 'weekly', priority: '0.7' })),
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

const distDir = toAbs('dist')
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })

fs.writeFileSync(toAbs('dist/sitemap.xml'), sitemap)
console.log(`✓ Sitemap generated: ${urls.length} URLs → ${SITE_URL}/sitemap.xml`)
