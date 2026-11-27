/**
 * Generates public/robots.txt (and copies to dist/robots.txt after build).
 * Uses VITE_APP_BASE_URL so the Sitemap: line always points to the correct domain.
 *
 * Run automatically as part of `npm run build`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const toAbs = (p: string) => path.resolve(root, p)

const SITE_URL = (loadEnv('production', root, 'VITE_').VITE_APP_BASE_URL ?? 'https://card-promo.com').replace(/\/$/, '')

const content = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /my-cards

Sitemap: ${SITE_URL}/sitemap.xml
`

// Write to dist/ (post-build) and also update public/ for local dev
const distDir = toAbs('dist')
if (fs.existsSync(distDir)) {
  fs.writeFileSync(toAbs('dist/robots.txt'), content)
  console.log(`✓ robots.txt written to dist/ → ${SITE_URL}/sitemap.xml`)
} else {
  // Fallback: update public/robots.txt (useful in dev)
  fs.writeFileSync(toAbs('public/robots.txt'), content)
  console.log(`✓ robots.txt updated in public/ → ${SITE_URL}/sitemap.xml`)
}
