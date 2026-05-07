import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './app/App'

/**
 * SSR render function called by scripts/prerender.ts.
 *
 * React 19 + react-helmet-async v3 compatibility note:
 * -------------------------------------------------------
 * With React 19's renderToString, react-helmet-async renders <Helmet> tag
 * content in two different ways depending on tag type:
 *
 *  • <title>, <meta>, <link>  → floated to the very beginning of the HTML
 *    string (before any layout divs). splitHeadFromBody() captures these.
 *
 *  • <script type="application/ld+json"> → rendered in-place (inside the
 *    main layout, wherever the component tree places them).
 *    extractJsonLd() captures these by scanning the full body HTML.
 *
 * If helmetContext IS populated (future-safe path), we use it directly.
 */
export function render(url: string) {
  const helmetContext: Record<string, unknown> = {}

  let html = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </HelmetProvider>,
  )

  // ── Path 1: helmetContext was populated correctly ──────────────────────────
  const { helmet } = helmetContext as {
    helmet?: Record<string, { toString(): string }>
  }

  let headTags = ''

  if (helmet?.title?.toString()?.includes('<title')) {
    headTags = [
      helmet.title?.toString() ?? '',
      helmet.meta?.toString() ?? '',
      helmet.link?.toString() ?? '',
      helmet.script?.toString() ?? '',
    ]
      .filter(Boolean)
      .join('\n')
  } else {
    // ── Path 2: React 19 fallback ─────────────────────────────────────────────
    // Step A: extract <title>/<meta>/<link>/<canonical> from front of HTML
    const split = splitHeadFromBody(html)
    html = split.bodyContent

    // Step B: extract <script type="application/ld+json"> from anywhere in body
    const jsonLd = extractJsonLd(html)
    html = jsonLd.strippedHtml

    headTags = [split.headContent, jsonLd.jsonLdTags].filter(Boolean).join('\n')
  }

  return { html, headTags }
}

/**
 * Split react-helmet-async-floated head tags (title, meta, link, canonical)
 * from the page body. These appear at the very start of the rendered HTML,
 * before the first structural layout element.
 */
function splitHeadFromBody(html: string): {
  headContent: string
  bodyContent: string
} {
  // First tag that can only appear in the body, not in <head>
  const bodyStartRe =
    /<(?:div|header|main|nav|section|article|footer|aside|ul|ol|table|form|h[1-6](?:\s|>)|p(?:\s|>))[^/]/

  const match = bodyStartRe.exec(html)

  if (!match || match.index === 0) {
    return { headContent: '', bodyContent: html }
  }

  return {
    headContent: html.slice(0, match.index).trim(),
    bodyContent: html.slice(match.index),
  }
}

/**
 * Extract all <script type="application/ld+json">…</script> blocks from the
 * body HTML (they are rendered in-place by react-helmet-async v3 + React 19,
 * not floated to the top like <title>/<meta>/<link>).
 * Returns the extracted tags and the HTML with those tags removed.
 */
function extractJsonLd(html: string): {
  jsonLdTags: string
  strippedHtml: string
} {
  const tags: string[] = []
  const stripped = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
    (match) => {
      tags.push(match)
      return ''
    },
  )
  return { jsonLdTags: tags.join('\n'), strippedHtml: stripped }
}
