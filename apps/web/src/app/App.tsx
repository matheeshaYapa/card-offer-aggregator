import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'

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

export default function App() {
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
