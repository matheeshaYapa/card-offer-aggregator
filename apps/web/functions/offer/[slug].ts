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
 *   2. If found and the build prerendered it → serve that page unchanged
 *      (full content, head tags, data snapshot).
 *      If found but newer than the build → serve the app shell (index.html,
 *      so hashed asset tags stay correct) with the <head> rewritten to the
 *      offer's real title, meta, canonical and JSON-LD, and #root replaced by
 *      a plain summary marked data-static (main.tsx renders fresh over it).
 *   3. If not found/expired → return HTTP 404 with a noindex head, so Google
 *      drops the URL instead of clustering it under the homepage.
 *
 * Required Pages environment variables (same values as the build):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, (optional) VITE_APP_BASE_URL
 */

import { sriLankaDate } from '../../src/utils/dateUtils'

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
  source_url: string | null
  discount_text: string | null
  valid_from: string | null
  valid_to: string | null
  category: { name: string } | null
  merchant: { name: string } | null
  offer_bank_rules: { bank: { name: string; short_name: string | null } | null }[] | null
}

const OFFER_SELECT =
  'title,slug,description,source_url,discount_text,valid_from,valid_to,' +
  'category:categories(name),merchant:merchants(name),' +
  'offer_bank_rules(bank:banks(name,short_name))'

export const onRequestGet = async (context: RequestContext): Promise<Response> => {
  const { request, env, params } = context
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug
  const requestUrl = new URL(request.url)
  if (requestUrl.pathname.endsWith('/') || requestUrl.pathname.endsWith('.html')) {
    requestUrl.pathname = requestUrl.pathname.replace(/\/$|\.html$/, '')
    return Response.redirect(requestUrl.href, 308)
  }
  const siteUrl = (env.VITE_APP_BASE_URL || 'https://card-promo.com').replace(/\/+$/, '')
  const canonical = `${siteUrl}/offer/${encodeURIComponent(slug)}`
  let offer: OfferRow | null
  try {
    offer = await fetchOffer(env, slug)
  } catch {
    return new Response('Card offers are temporarily unavailable. Please try again shortly.', {
      status: 503,
      headers: { 'retry-after': '300', 'cache-control': 'no-store' },
    })
  }

  // Offers that existed at build time have a fully prerendered page (content,
  // head tags and the data snapshot it hydrates from). Serve it as-is once
  // Supabase confirms the offer is still live. Anything else falls through to
  // the shell below — including the SPA fallback, which carries the homepage
  // canonical rather than this offer's.
  if (offer) {
    const page = await env.ASSETS.fetch(new URL(`/offer/${encodeURIComponent(slug)}`, request.url))
    if (page.ok) {
      const html = await page.text()
      const canonicalTag = html.match(/<link[^>]*rel="canonical"[^>]*>/)?.[0] ?? ''
      if (canonicalTag.includes(`href="${esc(canonical)}"`) && /<h1[\s>]/i.test(html)) {
        return new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=600' },
        })
      }
    }
  }

  if (!offer) {
    // A build-time snapshot can still contain this offer. Keep it out of the
    // error response so client hydration cannot resurrect a withdrawn offer.
    return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offer unavailable | CardPromo LK</title><meta name="robots" content="noindex, follow"></head><body><main style="max-width:42rem;margin:4rem auto;padding:1rem;font:1rem/1.6 system-ui"><h1>Offer unavailable</h1><p>This promotion may have ended or been removed.</p><a href="/offers">Browse current card offers in Sri Lanka</a></main></body></html>', {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  const shell = await env.ASSETS.fetch(new URL('/', request.url))
  if (!shell.ok) return new Response('Temporarily unavailable', { status: 503, headers: { 'retry-after': '300' } })
  return rewrite(shell, buildHead(offer, canonical, siteUrl), { status: 200, cache: true, body: buildBody(offer) })
}

export async function onRequestHead(context: RequestContext): Promise<Response> {
  const response = await onRequestGet(context)
  return new Response(null, { status: response.status, headers: response.headers })
}

// ── Supabase lookup ─────────────────────────────────────────────────────────

async function fetchOffer(env: Env, slug: string): Promise<OfferRow | null> {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw new Error('Missing public database configuration')
  const base = env.VITE_SUPABASE_URL.replace(/\/+$/, '')
  const today = sriLankaDate()
  const url =
    `${base}/rest/v1/offers?slug=eq.${encodeURIComponent(slug)}` +
    `&status=eq.approved&is_active=eq.true&limit=1` +
    `&and=(or(valid_from.is.null,valid_from.lte.${today}),or(valid_to.is.null,valid_to.gte.${today}))` +
    `&select=${encodeURIComponent(OFFER_SELECT)}`
  const resp = await fetch(url, {
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
  })
  if (!resp.ok) throw new Error(`Offer lookup failed (${resp.status})`)
  const rows = (await resp.json()) as OfferRow[]
  if (!Array.isArray(rows)) throw new Error('Unexpected offer response')
  return rows[0] ?? null
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

/**
 * Plain, crawler-readable summary for offers added after the last build. The
 * #root is marked data-static so the client renders fresh instead of trying
 * to hydrate it (see apps/web/src/main.tsx).
 */
function buildBody(offer: OfferRow): string {
  const bank = offer.offer_bank_rules?.find((r) => r.bank)?.bank
  const parts = [
    `<main style="max-width:42rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif">`,
    `<p><a href="/">CardPromo LK</a> › Card offers</p>`,
    `<h1>${esc(offer.title?.trim() || 'Card offer')}</h1>`,
    offer.discount_text ? `<p><strong>${esc(offer.discount_text)}</strong></p>` : '',
    offer.merchant?.name ? `<p>Merchant: ${esc(offer.merchant.name)}</p>` : '',
    bank ? `<p>Bank: ${esc(bank.name)}</p>` : '',
    offer.category?.name ? `<p>Category: ${esc(offer.category.name)}</p>` : '',
    offer.valid_to ? `<p>Valid until ${esc(offer.valid_to)}</p>` : '',
    offer.description ? `<p>${esc(offer.description)}</p>` : '',
    offer.source_url && /^https?:\/\//i.test(offer.source_url) ? `<p><a href="${esc(offer.source_url)}">View the bank’s offer details</a></p>` : '',
    `<p><a href="/offers">Browse all card offers in Sri Lanka</a></p>`,
    `</main>`,
  ]
  return parts.join('')
}

// ── HTMLRewriter plumbing ───────────────────────────────────────────────────

function rewrite(
  shell: Response,
  headHtml: string,
  opts: { status: number; cache?: boolean; body?: string },
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
    // Replace the prerendered homepage body with the offer summary (or nothing).
    .on('#root', new StaticRoot(opts.body ?? ''))
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
class StaticRoot {
  constructor(private html: string) {}
  element(el: {
    setInnerContent: (html: string, opts: { html: boolean }) => void
    setAttribute: (name: string, value: string) => void
  }) {
    el.setInnerContent(this.html, { html: true })
    el.setAttribute('data-static', '')
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
