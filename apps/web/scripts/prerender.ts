/**
 * Pre-render script: generates static HTML for each route using the SSR bundle.
 * Run after: `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist/.ssr`
 *
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadSnapshot, writeSnapshot } from './snapshot'
import { OFFERS_PER_PAGE, offerPagePath } from '../src/utils/offerPagination'
import { slimForSnapshot, SNAPSHOT_META_NAME, type PublicSnapshot } from '../src/lib/snapshotData'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const toAbs = (p: string) => path.resolve(root, p)

// Use the same public data for route discovery, server rendering and hydration.
const snapshot = slimForSnapshot(await loadSnapshot(root))
const snapshotUrl = writeSnapshot(toAbs('dist'), snapshot)
const snapshotMeta = `<meta name="${SNAPSHOT_META_NAME}" content="${snapshotUrl}" />\n` +
  `<link rel="preload" href="${snapshotUrl}" as="fetch" crossorigin="anonymous" />`

const template = fs.readFileSync(toAbs('dist/index.html'), 'utf-8')
fs.writeFileSync(toAbs('dist/admin-app.html'), template.replace(
  '<!--app-head-->', '<meta name="robots" content="noindex, nofollow" />',
))

const routes = [
  '/',
  '/offers',
  ...Array.from({ length: Math.max(0, Math.ceil(snapshot.offers.length / OFFERS_PER_PAGE) - 1) },
    (_, index) => offerPagePath(index + 2)),
  '/my-cards',
  '/404',
  ...snapshot.banks.map(({ slug }) => `/bank/${slug}`),
  ...snapshot.categories.map(({ slug }) => `/category/${slug}`),
  ...snapshot.offers.map(({ slug }) => `/offer/${slug}`),
]

// Dynamically import the SSR bundle built by `vite build --ssr`
const ssrBundleUrl = pathToFileURL(toAbs('dist/.ssr/entry-server.js')).href
const { render } = (await import(ssrBundleUrl)) as {
  render: (url: string, data: PublicSnapshot | null) => { html: string; headTags: string }
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
  const { html: appHtml, headTags } = render(url, snapshot)

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
    .replace('<!--app-head-->', `${stampedHeadTags}\n${snapshotMeta}`)
    .replace('<div id="root"><!--app-html--></div>', `<div id="root">${appHtml}</div>`)

  const fullHtml = removeHeadDuplicates(rawHtml)

  const filePath =
    url === '/' ? toAbs('dist/index.html') : toAbs(`dist${url}.html`)

  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  fs.writeFileSync(filePath, fullHtml)
  console.log(`  ✓ ${url}`)
  count++
}

// Clean up the temporary SSR bundle
fs.rmSync(toAbs('dist/.ssr'), { recursive: true, force: true })

console.log(`\n✓ Pre-rendered ${count} pages`)
