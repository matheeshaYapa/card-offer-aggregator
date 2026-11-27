import { StrictMode } from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './app/App'
import { PublicSnapshotProvider, SNAPSHOT_META_NAME, type PublicSnapshot } from './lib/publicSnapshot'
import './styles/global.css'

const rootElement = document.getElementById('root')!

/** Load the build-time data snapshot this page was prerendered with, if any. */
async function loadSnapshot(): Promise<PublicSnapshot | null> {
  const url = document.querySelector<HTMLMetaElement>(`meta[name="${SNAPSHOT_META_NAME}"]`)?.content
  if (!url) return null
  try {
    const response = await fetch(url)
    return response.ok ? ((await response.json()) as PublicSnapshot) : null
  } catch {
    return null
  }
}

async function start() {
  const snapshot = await loadSnapshot()
  const app = (
    <StrictMode>
      <HelmetProvider>
        <PublicSnapshotProvider snapshot={snapshot}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PublicSnapshotProvider>
      </HelmetProvider>
    </StrictMode>
  )

  // Hydrate only markup that was prerendered for exactly this URL with the
  // snapshot we just loaded. Everything else is rendered fresh:
  //  - dev, where #root holds only the <!--app-html--> placeholder;
  //  - URLs with a query string (static HTML is for the bare path);
  //  - edge-rendered offer pages, marked data-static, whose markup is a
  //    plain crawler fallback rather than React output.
  const prerendered = rootElement.firstElementChild && !rootElement.hasAttribute('data-static')
  if (prerendered && snapshot && !window.location.search) {
    hydrateRoot(rootElement, app)
  } else {
    createRoot(rootElement).render(app)
  }
}

void start()
