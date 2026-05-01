/**
 * Generates sitemap.xml from static data.
 * Run after the pre-render step as part of the production build.
 *
 * Future backend: replace static JSON reads with a live API call.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const toAbs = (p: string) => path.resolve(root, p)

const SITE_URL = process.env.VITE_SITE_URL ?? 'https://cardpromo.lk'

const banks: Array<{ id: string }> = JSON.parse(
  fs.readFileSync(toAbs('src/data/banks.json'), 'utf-8'),
)
const categories: Array<{ id: string }> = JSON.parse(
  fs.readFileSync(toAbs('src/data/categories.json'), 'utf-8'),
)
const offers: Array<{ id: string; isActive: boolean }> = JSON.parse(
  fs.readFileSync(toAbs('src/data/offers.json'), 'utf-8'),
)

const today = new Date().toISOString().split('T')[0]

const urls: Array<{ loc: string; changefreq: string; priority: string }> = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/my-cards', changefreq: 'monthly', priority: '0.5' },
  ...banks.map((b) => ({
    loc: `/bank/${b.id}`,
    changefreq: 'weekly',
    priority: '0.8',
  })),
  ...categories.map((c) => ({
    loc: `/category/${c.id}`,
    changefreq: 'weekly',
    priority: '0.8',
  })),
  ...offers
    .filter((o) => o.isActive)
    .map((o) => ({
      loc: `/offer/${o.id}`,
      changefreq: 'weekly',
      priority: '0.7',
    })),
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`

const distDir = toAbs('dist')
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })

fs.writeFileSync(toAbs('dist/sitemap.xml'), sitemap)
console.log(`✓ Sitemap generated: ${urls.length} URLs`)
