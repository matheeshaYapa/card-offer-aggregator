import { StrictMode } from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './app/App'
import './styles/global.css'

const rootElement = document.getElementById('root')!

const app = (
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
)

// Hydrate if pre-rendered (SSG build), otherwise mount fresh (dev)
if (rootElement.innerHTML.trim()) {
  hydrateRoot(rootElement, app)
} else {
  createRoot(rootElement).render(app)
}
