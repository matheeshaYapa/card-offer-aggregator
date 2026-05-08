import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'

// ── Public layout + pages ─────────────────────────────────────────────────
import PageContainer from '@/components/layout/PageContainer'
import HomePage from '@/pages/public/HomePage'
import OffersPage from '@/pages/public/OffersPage'
import MyCardsPage from '@/pages/public/MyCardsPage'
import OfferDetailsPage from '@/pages/public/OfferDetailsPage'
import BankPage from '@/pages/public/BankPage'
import CategoryPage from '@/pages/public/CategoryPage'
import NotFoundPage from '@/pages/public/NotFoundPage'

// ── Admin layout (lazy) ───────────────────────────────────────────────────
import ProtectedRoute from '@/components/admin/ProtectedRoute'
const AdminLayout                = lazy(() => import('@/components/admin/AdminLayout'))
const AdminLoginPage             = lazy(() => import('@/pages/admin/AdminLoginPage'))
const AdminDashboardPage         = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminBanksPage             = lazy(() => import('@/pages/admin/AdminBanksPage'))
const AdminCardsPage             = lazy(() => import('@/pages/admin/AdminCardsPage'))
const AdminCategoriesPage        = lazy(() => import('@/pages/admin/AdminCategoriesPage'))
const AdminMerchantsPage         = lazy(() => import('@/pages/admin/AdminMerchantsPage'))
const AdminOffersPage            = lazy(() => import('@/pages/admin/AdminOffersPage'))
const AdminOfferFormPage         = lazy(() => import('@/pages/admin/AdminOfferFormPage'))
const AdminScrapedCandidatesPage = lazy(() => import('@/pages/admin/AdminScrapedCandidatesPage'))
const AdminScrapeRunsPage        = lazy(() => import('@/pages/admin/AdminScrapeRunsPage'))

function AdminSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function A({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<AdminSpinner />}>{children}</Suspense>
}

/**
 * React 19 natively hoists <title>, <meta>, <link> from anywhere in the
 * component tree to <head> (document metadata feature). react-helmet-async
 * ALSO manages these tags via DOM manipulation using data-rh="".
 * When both systems run, the head ends up with duplicate tags.
 *
 * This hook removes duplicates after hydration and watches for re-hoisting
 * on subsequent navigations/re-renders.
 */
function useDeduplicateHeadTags() {
  useEffect(() => {
    function dedup() {
      const head = document.head

      // Keep only the data-rh title (react-helmet-async's); remove native-hoisted ones
      const titles = head.querySelectorAll('title')
      if (titles.length > 1) {
        const keep = Array.from(titles).find((t) => t.hasAttribute('data-rh'))
          ?? titles[titles.length - 1]
        titles.forEach((t) => { if (t !== keep) t.parentNode?.removeChild(t) })
      }

      // Remove duplicate meta description / og:* / twitter:* without data-rh
      const seen = new Set<string>()
      head.querySelectorAll('meta[name], meta[property]').forEach((m) => {
        const key = m.getAttribute('name') ?? m.getAttribute('property') ?? ''
        if (!key) return
        if (seen.has(key)) {
          // Duplicate — remove the one WITHOUT data-rh (the natively hoisted one)
          if (!m.hasAttribute('data-rh')) m.parentNode?.removeChild(m)
        } else {
          seen.add(key)
        }
      })

      // Remove duplicate canonical links without data-rh
      const canonicals = head.querySelectorAll('link[rel="canonical"]')
      if (canonicals.length > 1) {
        canonicals.forEach((l) => {
          if (!l.hasAttribute('data-rh')) l.parentNode?.removeChild(l)
        })
      }
    }

    // Run immediately after hydration
    dedup()

    // Watch for React 19 re-hoisting on subsequent navigations
    const observer = new MutationObserver(dedup)
    observer.observe(document.head, { childList: true, subtree: false })
    return () => observer.disconnect()
  }, [])
}

export default function App() {
  useDeduplicateHeadTags()

  return (
    <Routes>
      {/* ── Public routes ── */}
      <Route element={<PageContainer />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/my-cards" element={<MyCardsPage />} />
        <Route path="/offer/:offerSlug" element={<OfferDetailsPage />} />
        <Route path="/bank/:bankSlug" element={<BankPage />} />
        <Route path="/category/:categorySlug" element={<CategoryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* ── Admin login (no auth required) ── */}
      <Route path="/admin/login" element={<A><AdminLoginPage /></A>} />

      {/* ── Protected admin routes ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<A><AdminLayout /></A>}>
          <Route path="/admin"                       element={<A><AdminDashboardPage /></A>} />
          <Route path="/admin/dashboard"             element={<A><AdminDashboardPage /></A>} />
          <Route path="/admin/banks"                 element={<A><AdminBanksPage /></A>} />
          <Route path="/admin/cards"                 element={<A><AdminCardsPage /></A>} />
          <Route path="/admin/categories"            element={<A><AdminCategoriesPage /></A>} />
          <Route path="/admin/merchants"             element={<A><AdminMerchantsPage /></A>} />
          <Route path="/admin/offers"                element={<A><AdminOffersPage /></A>} />
          <Route path="/admin/offers/new"            element={<A><AdminOfferFormPage /></A>} />
          <Route path="/admin/offers/:offerId/edit"  element={<A><AdminOfferFormPage /></A>} />
          <Route path="/admin/scraped-candidates"    element={<A><AdminScrapedCandidatesPage /></A>} />
          <Route path="/admin/scrape-runs"           element={<A><AdminScrapeRunsPage /></A>} />
        </Route>
      </Route>
    </Routes>
  )
}
