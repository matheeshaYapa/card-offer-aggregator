import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './app/App'
import { PublicSnapshotProvider, type PublicSnapshot } from './lib/publicSnapshot'

/**
 * SSR render function called by scripts/prerender.ts.
 *
 * React 19 + react-helmet-async v3 compatibility note:
 * -------------------------------------------------------
 * With React 19's renderToString, react-helmet-async floats <title>, <meta>
 * and <link> to the very beginning of the HTML string; splitHeadFromBody()
 * moves those into <head>. <script type="application/ld+json"> is rendered
 * in place, on the server and on the client, so it is left in the body —
 * moving it breaks hydration.
 *
 * If helmetContext IS populated (future-safe path), we use it directly.
 */
export function render(url: string, snapshot: PublicSnapshot | null = null) {
  const helmetContext: Record<string, unknown> = {}

  let html = renderToString(
    <HelmetProvider context={helmetContext}>
      <PublicSnapshotProvider snapshot={snapshot}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </PublicSnapshotProvider>
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

    // JSON-LD <script>s stay where React rendered them: react-helmet-async v3
    // renders them in place on the client too, so moving them into <head>
    // made hydration fail (React #418) and discard the server HTML. Search
    // engines read JSON-LD anywhere in the document.
    headTags = split.headContent
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
