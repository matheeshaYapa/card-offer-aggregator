/**
 * Generates sitemap.xml after the production build.
 * Include current offer pages and bank/category pages with matching offers.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { loadSnapshot, readWrittenSnapshot } from './snapshot'
import { getOfferStats } from '../src/utils/offerStats'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const toAbs = (p: string) => path.resolve(root, p)

// Strip trailing slash so URLs never double up (e.g. https://domain.com/ + /offers = //offers)
const SITE_URL = (loadEnv('production', root, 'VITE_').VITE_APP_BASE_URL ?? 'https://card-promo.com').replace(/\/$/, '')

// The standalone IndexNow job has no build output and reads the same public catalogue.
const builtSnapshot = readWrittenSnapshot(toAbs('dist'))
const snapshot = builtSnapshot ?? await loadSnapshot(root)
const stats = getOfferStats(snapshot.offers)
const paths = [
  '/', '/offers',
  ...stats.topBanks.map(({ item }) => `/bank/${item.slug}`),
  ...stats.topCategories.map(({ item }) => `/category/${item.slug}`),
  ...snapshot.offers.map(({ slug }) => `/offer/${slug}`),
]

if (builtSnapshot) {
  for (const route of paths) {
    const file = toAbs(route === '/' ? 'dist/index.html' : `dist${route}.html`)
    const html = fs.readFileSync(file, 'utf-8')
    const head = html.split('</head>')[0]
    const canonicals = head.match(/<link\b[^>]*rel="canonical"[^>]*>/gi) ?? []
    if (canonicals.length !== 1 || !canonicals[0].includes(`href="${SITE_URL}${route}"`) ||
        /<meta\b[^>]*name="robots"[^>]*noindex/i.test(head) || !/<h1[\s>]/i.test(html)) {
      throw new Error(`Sitemap page must have content and one indexable canonical: ${route}`)
    }
  }
}

// A build time is not a content modification time. Omit lastmod until the
// catalogue tracks meaningful changes to the offer and its joined records.
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((route) => `  <url><loc>${SITE_URL}${route.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</loc></url>`).join('\n')}
</urlset>`

const distDir = toAbs('dist')
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })

fs.writeFileSync(toAbs('dist/sitemap.xml'), sitemap)
console.log(`✓ Sitemap generated: ${paths.length} URLs → ${SITE_URL}/sitemap.xml`)
