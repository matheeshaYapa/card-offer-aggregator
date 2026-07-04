/**
 * Cloudflare Pages Function — edge SSR for /offer/<slug> (GSC Option B).
 *
 * Problem it solves:
 *   Build-time SSG only prerenders offers that exist at build time. Offers the
 *   daily scraper adds later fall back to index.html and inherit the HOMEPAGE
 *   canonical (`/`), so Google files them as "Alternative page with proper
 *   canonical"; expired offers render a client-side noindex state.
 *
 * What this does (on every request, no rebuild needed):
 *   1. Look up the offer in Supabase (anon key + RLS → only approved, active,
 *      non-expired offers are visible).
 *   2. If found → serve the app shell (index.html, so hashed asset tags stay
 *      correct) with the <head> rewritten to the offer's real title, meta,
 *      canonical (self-referential) and JSON-LD. The #root is emptied so the
 *      client renders the offer cleanly (no homepage-flash / hydration
 *      mismatch — main.tsx uses createRoot when #root is empty).
 *   3. If not found/expired → return HTTP 404 with a noindex head, so Google
 *      drops the URL instead of clustering it under the homepage.
 *
 * Required Pages environment variables (same values as the build):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, (optional) VITE_APP_BASE_URL
 */

// ── Minimal ambient types (Cloudflare's build strips these) ────────────────
declare class HTMLRewriter {
  on(selector: string, handler: unknown): this
  transform(response: Response): Response
}

interface Env {
  ASSETS: { fetch: (input: Request | string | URL) => Promise<Response> }
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
  VITE_APP_BASE_URL?: string
}

interface RequestContext {
  request: Request
  env: Env
  params: Record<string, string | string[]>
}

interface OfferRow {
  title: string | null
  slug: string
  description: string | null
  discount_text: string | null
  valid_from: string | null
  valid_to: string | null
  category: { name: string } | null
  merchant: { name: string } | null
  offer_bank_rules: { bank: { name: string; short_name: string | null } | null }[] | null
}

const OFFER_SELECT =
  'title,slug,description,discount_text,valid_from,valid_to,' +
  'category:categories(name),merchant:merchants(name),' +
  'offer_bank_rules(bank:banks(name,short_name))'

export const onRequestGet = async (context: RequestContext): Promise<Response> => {
  const { request, env, params } = context
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug
  const siteUrl = (env.VITE_APP_BASE_URL || new URL(request.url).origin).replace(/\/+$/, '')
  const canonical = `${siteUrl}/offer/${slug}`

  // App shell — keeps the deployed build's hashed <script>/<link> tags.
  const shell = await env.ASSETS.fetch(new URL('/index.html', request.url))

  const offer = await fetchOffer(env, slug)

  if (!offer) {
    const head = [
      '<title>Offer Not Found | CardPromo LK</title>',
      '<meta name="robots" content="noindex, nofollow">',
    ].join('')
    return rewrite(shell, head, { status: 404 })
  }

  return rewrite(shell, buildHead(offer, canonical, siteUrl), { status: 200, cache: true })
}

// ── Supabase lookup ─────────────────────────────────────────────────────────

async function fetchOffer(env: Env, slug: string): Promise<OfferRow | null> {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return null
  const base = env.VITE_SUPABASE_URL.replace(/\/+$/, '')
  const url =
    `${base}/rest/v1/offers?slug=eq.${encodeURIComponent(slug)}` +
    `&status=eq.approved&is_active=eq.true&limit=1` +
    `&select=${encodeURIComponent(OFFER_SELECT)}`
  try {
    const resp = await fetch(url, {
      headers: {
        apikey: env.VITE_SUPABASE_ANON_KEY,
        authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      },
    })
    if (!resp.ok) return null
    const rows = (await resp.json()) as OfferRow[]
    return Array.isArray(rows) && rows.length ? rows[0] : null
  } catch {
    return null
  }
}

// ── Head construction ───────────────────────────────────────────────────────

function buildHead(offer: OfferRow, canonical: string, siteUrl: string): string {
  const title = offer.title?.trim() || 'Card Offer'
  const bank = offer.offer_bank_rules?.find((r) => r.bank)?.bank
  const bankName = bank?.short_name || bank?.name || 'Sri Lanka'
  const fullTitle = `${title} – ${bankName} | CardPromo LK`

  const description =
    offer.description?.trim() ||
    `${title}. ${offer.discount_text ? `Discount: ${offer.discount_text}. ` : ''}` +
      `Valid for ${bankName} cardholders in Sri Lanka.`

  const ogImage = `${siteUrl}/og-cover.png`

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: title,
    description,
    url: canonical,
    areaServed: 'LK',
  }
  if (offer.category?.name) jsonLd.category = offer.category.name
  if (bank) jsonLd.seller = { '@type': 'Organization', name: bank.name }
  if (offer.valid_from) jsonLd.availabilityStarts = offer.valid_from
  if (offer.valid_to) jsonLd.availabilityEnds = offer.valid_to

  return [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${esc(fullTitle)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:image" content="${esc(ogImage)}">`,
    `<meta property="og:site_name" content="CardPromo LK">`,
    `<meta property="og:locale" content="en_LK">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(fullTitle)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(ogImage)}">`,
    `<script type="application/ld+json">${jsonLdSafe(jsonLd)}</script>`,
  ].join('')
}

// ── HTMLRewriter plumbing ───────────────────────────────────────────────────

function rewrite(
  shell: Response,
  headHtml: string,
  opts: { status: number; cache?: boolean },
): Response {
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' })
  headers.set(
    'cache-control',
    opts.cache ? 'public, max-age=0, s-maxage=600' : 'no-store',
  )

  // Rebuild the response with our status/headers, keep the streamed body.
  const base = new Response(shell.body, { status: opts.status, headers })

  return new HTMLRewriter()
    // Strip the homepage's SEO tags so we don't leave a wrong canonical/title.
    .on('title', new Remove())
    .on('link[rel="canonical"]', new Remove())
    .on('meta[name="description"]', new Remove())
    .on('meta[property^="og:"]', new Remove())
    .on('meta[name^="twitter:"]', new Remove())
    .on('meta[name="robots"]', new Remove())
    .on('script[type="application/ld+json"]', new Remove())
    // Inject the offer's tags at the end of <head>.
    .on('head', new AppendHead(headHtml))
    // Empty the prerendered homepage body so the client renders the offer cleanly.
    .on('#root', new EmptyRoot())
    .transform(base)
}

class Remove {
  element(el: { remove: () => void }) {
    el.remove()
  }
}
class AppendHead {
  constructor(private html: string) {}
  element(el: { append: (html: string, opts: { html: boolean }) => void }) {
    el.append(this.html, { html: true })
  }
}
class EmptyRoot {
  element(el: { setInnerContent: (html: string, opts: { html: boolean }) => void }) {
    el.setInnerContent('', { html: true })
  }
}

// ── Escaping helpers ────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** JSON-LD safe for inline <script>: prevent `</script>` and HTML breakout. */
function jsonLdSafe(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}
