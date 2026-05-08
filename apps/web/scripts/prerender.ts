/**
 * Pre-render script: generates static HTML for each route using the SSR bundle.
 * Run after: `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist/.ssr`
 *
 * Route discovery:
 *  - When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are present, slugs are fetched
 *    live from Supabase so new content is included automatically.
 *  - Otherwise falls back to the slugs seeded in migration 003_seed_base_data.sql.
 *    Update SEED_* arrays when you add banks/categories/offers manually.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Load .env.local for local builds (Cloudflare/Vercel inject these as real env vars)
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

// ── Seed fallback slugs (mirrors migration 003_seed_base_data.sql) ──────────
const SEED_BANK_SLUGS = ['commercial-bank', 'sampath-bank', 'hnb', 'boc', 'peoples-bank']
const SEED_CATEGORY_SLUGS = ['dining', 'shopping', 'travel', 'supermarket', 'electronics']
const SEED_OFFER_SLUGS = [
  'combank-20-off-selected-restaurants',
  'sampath-10-cashback-keells-super',
  'hnb-15-off-cinnamon-hotels',
  'boc-5-cashback-fuel',
  'sampath-12-off-abans',
  'hnb-bogo-hotel-buffet',
  'boc-0-installment-singer',
  'combank-5-cashback-cargills',
]

let bankSlugs = SEED_BANK_SLUGS
let categorySlugs = SEED_CATEGORY_SLUGS
let offerSlugs = SEED_OFFER_SLUGS

// ── Try to fetch live slugs from Supabase ────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (supabaseUrl && supabaseAnonKey) {
  console.log('Fetching routes from Supabase…')
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
} else {
  console.log('No Supabase env vars — using seed route list.')
}

const template = fs.readFileSync(toAbs('dist/index.html'), 'utf-8')

const routes = [
  '/',
  '/offers',
  '/my-cards',
  ...bankSlugs.map((s) => `/bank/${s}`),
  ...categorySlugs.map((s) => `/category/${s}`),
  ...offerSlugs.map((s) => `/offer/${s}`),
]

// Dynamically import the SSR bundle built by `vite build --ssr`
const ssrBundleUrl = pathToFileURL(toAbs('dist/.ssr/entry-server.js')).href
const { render } = (await import(ssrBundleUrl)) as {
  render: (url: string) => { html: string; headTags: string }
}

/**
 * Strip any duplicate SEO head tags that don't carry data-rh="".
 *
 * Why this is needed:
 *   react-helmet-async + React 19 renderToString can produce head tags in
 *   multiple places in the HTML (at the top of the render tree AND inline
 *   where the Helmet component sits). Vite plugin transformations may also
 *   inject additional copies. This pass keeps ONLY the canonical set that
 *   carries data-rh="" (our intentionally stamped SSR tags) and removes
 *   everything else, regardless of where in the document it appears.
 *
 * Tags kept without data-rh (structural/asset tags):
 *   charset, viewport, theme-color, favicon, apple-touch-icon,
 *   manifest, modulepreload, stylesheet, preload, script (vite/pwa)
 */
function removeHeadDuplicates(html: string): string {
  const headEnd = html.indexOf('</head>')
  if (headEnd === -1) return html

  let head = html.slice(0, headEnd)
  const rest = html.slice(headEnd) // </head>…<body>…

  // Remove <title> tags WITHOUT data-rh (keep data-rh ones)
  head = head.replace(/<title(?![^>]*data-rh)[^>]*>[\s\S]*?<\/title>/g, '')

  // Remove <meta> tags that are SEO-related and DON'T carry data-rh.
  // Preserve: charset, viewport, theme-color (structural/pwa).
  head = head.replace(
    /<meta(?![^>]*data-rh)[^>]*(?:name="description"|property="og:|name="twitter:|name="robots")[^>]*\/?>/g,
    '',
  )

  // Remove <link rel="canonical"> WITHOUT data-rh
  head = head.replace(
    /<link(?![^>]*data-rh)[^>]*rel="canonical"[^>]*\/?>/g,
    '',
  )

  // Remove stray JSON-LD <script> tags WITHOUT data-rh
  head = head.replace(
    /<script(?![^>]*data-rh)[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,
    '',
  )

  return head + rest
}

let count = 0

for (const url of routes) {
  const { html: appHtml, headTags } = render(url)

  // Stamp all injected head tags with data-rh="" so react-helmet-async
  // recognises them on client hydration and REPLACES them instead of
  // appending new duplicates.
  const stampedHeadTags = headTags.replace(
    /<(title|meta|link|script)(\s|>)/g,
    (_match, tag: string, rest: string) => `<${tag} data-rh=""${rest}`,
  )

  // Build the full HTML then run the dedup cleanup pass.
  // The cleanup handles any duplicates regardless of their origin
  // (template leftovers, vite-plugin-pwa injections, SSR double-renders, etc.)
  const rawHtml = template
    .replace('<!--app-head-->', stampedHeadTags)
    .replace('<div id="root"><!--app-html--></div>', `<div id="root">${appHtml}</div>`)

  const fullHtml = removeHeadDuplicates(rawHtml)

  const filePath =
    url === '/' ? toAbs('dist/index.html') : toAbs(`dist${url}/index.html`)

  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  fs.writeFileSync(filePath, fullHtml)
  console.log(`  ✓ ${url}`)
  count++
}

// Clean up the temporary SSR bundle
fs.rmSync(toAbs('dist/.ssr'), { recursive: true, force: true })

console.log(`\n✓ Pre-rendered ${count} pages`)
