/**
 * Pre-render script: generates static HTML for each route using the SSR bundle.
 * Run after: `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist/.ssr`
 *
 * Future backend integration: replace static JSON reads with API calls to fetch
 * live offer, bank, and category data before generating pages.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const toAbs = (p: string) => path.resolve(root, p)

const template = fs.readFileSync(toAbs('dist/index.html'), 'utf-8')

const banks: Array<{ id: string }> = JSON.parse(
  fs.readFileSync(toAbs('src/data/banks.json'), 'utf-8'),
)
const categories: Array<{ id: string }> = JSON.parse(
  fs.readFileSync(toAbs('src/data/categories.json'), 'utf-8'),
)
const offers: Array<{ id: string; isActive: boolean }> = JSON.parse(
  fs.readFileSync(toAbs('src/data/offers.json'), 'utf-8'),
)

const routes = [
  '/',
  '/my-cards',
  ...banks.map((b) => `/bank/${b.id}`),
  ...categories.map((c) => `/category/${c.id}`),
  ...offers.filter((o) => o.isActive).map((o) => `/offer/${o.id}`),
]

// Dynamically import the SSR bundle built by `vite build --ssr`
const ssrBundleUrl = pathToFileURL(toAbs('dist/.ssr/entry-server.js')).href
const { render } = (await import(ssrBundleUrl)) as {
  render: (url: string) => { html: string; headTags: string }
}

let count = 0

for (const url of routes) {
  const { html: appHtml, headTags } = render(url)

  const fullHtml = template
    .replace('<!--app-head-->', headTags)
    .replace('<div id="root"><!--app-html--></div>', `<div id="root">${appHtml}</div>`)

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
