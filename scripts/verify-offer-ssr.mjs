/**
 * Post-deploy check for the /offer/* edge SSR Pages Function (GSC Option B).
 *
 * Verifies, against a deployed URL, that:
 *   1. a real offer page returns HTTP 200 with a SELF-referential canonical
 *      (not the homepage "/") and is not marked noindex;
 *   2. a bogus slug returns HTTP 404 with a noindex robots tag.
 *
 * Usage:
 *   node scripts/verify-offer-ssr.mjs https://card-promo.com [offer-slug]
 *
 * If no slug is given, one is discovered from the deployed sitemap.xml.
 * Exits 0 if all checks pass, 1 otherwise (usable in CI).
 */

const base = (process.argv[2] || '').replace(/\/+$/, '')
if (!base) {
  console.error('Usage: node scripts/verify-offer-ssr.mjs <base-url> [offer-slug]')
  process.exit(2)
}

const UA = { 'user-agent': 'CardPromo-SSR-Verifier/1.0' }
let failures = 0

function check(label, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}

function canonicalOf(html) {
  // Attribute-order-independent: scan every <link> for rel="canonical".
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (/rel=["']canonical["']/i.test(tag)) {
      const h = tag.match(/href=["']([^"']+)["']/i)
      if (h) return h[1]
    }
  }
  return null
}
function isNoindex(html) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (/name=["']robots["']/i.test(tag) && /content=["'][^"']*noindex/i.test(tag)) {
      return true
    }
  }
  return false
}

async function discoverSlug() {
  try {
    const res = await fetch(`${base}/sitemap.xml`, { headers: UA })
    if (!res.ok) return null
    const xml = await res.text()
    const m = xml.match(/\/offer\/([^<>"/\s]+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

async function main() {
  let slug = process.argv[3]
  if (!slug) {
    console.log('No slug given — discovering one from sitemap.xml…')
    slug = await discoverSlug()
    if (!slug) {
      console.error('Could not find an /offer/ URL in the sitemap. Pass a slug explicitly.')
      process.exit(2)
    }
  }

  const realUrl = `${base}/offer/${slug}`
  console.log(`\nReal offer: ${realUrl}`)
  const real = await fetch(realUrl, { headers: UA })
  const realHtml = await real.text()
  const canon = canonicalOf(realHtml)
  check('HTTP 200', real.status === 200, `got ${real.status}`)
  check('canonical is self-referential', canon === realUrl, `canonical=${canon}`)
  check('canonical is not the homepage', canon !== `${base}/` && canon !== base, `canonical=${canon}`)
  check('not noindex', !isNoindex(realHtml))

  const bogusUrl = `${base}/offer/__does-not-exist-${Date.now().toString(36)}`
  console.log(`\nBogus offer: ${bogusUrl}`)
  const bogus = await fetch(bogusUrl, { headers: UA })
  const bogusHtml = await bogus.text()
  check('HTTP 404', bogus.status === 404, `got ${bogus.status}`)
  check('is noindex', isNoindex(bogusHtml))

  console.log(`\n${failures === 0 ? 'PASS — edge SSR is working.' : `FAIL — ${failures} check(s) failed.`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('Verifier error:', e)
  process.exit(2)
})
