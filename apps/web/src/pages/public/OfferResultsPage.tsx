import { Link, Navigate, useParams } from 'react-router-dom'
import MetaTags from '@/components/seo/MetaTags'
import OfferGrid from '@/components/offers/OfferGrid'
import { usePublicBrowseData } from '@/hooks/usePublicBrowseData'
import { offerPagePath, OFFERS_PER_PAGE } from '@/utils/offerPagination'
import { canonicalUrl } from '@/utils/seo'
import NotFoundPage from './NotFoundPage'

export default function OfferResultsPage() {
  const { pageNumber = '' } = useParams()
  const { offers, loading, error, reload } = usePublicBrowseData()
  const page = Number(pageNumber)
  const start = (page - 1) * OFFERS_PER_PAGE
  if (pageNumber === '1') return <Navigate to="/offers" replace />
  if (!/^[1-9]\d*$/.test(pageNumber) || !Number.isSafeInteger(page) ||
      (!loading && !error && start >= offers.length)) return <NotFoundPage />

  const end = Math.min(start + OFFERS_PER_PAGE, offers.length)
  return (
    <section className="browse-shell">
      <MetaTags title={`Credit and debit card offers in Sri Lanka · Page ${page}`}
        description={`Browse page ${page} of current Sri Lankan card promotions, including eligible cards, offer terms and links to the banks.`}
        canonical={canonicalUrl(offerPagePath(page))} />
      <Link className="back-link" to="/offers">Browse and filter all offers</Link>
      <h1 className="text-2xl font-bold mb-2">Card offers in Sri Lanka · Page {page}</h1>
      {error ? <button className="browse-action" onClick={() => void reload()}>Retry loading offers</button> : <>
        {!loading && <p className="mb-4">Showing offers {start + 1}–{end} of {offers.length}</p>}
        <OfferGrid offers={offers.slice(start, end)} loading={loading} showCount={false} compact />
        <nav aria-label="Offer results pages" className="flex justify-between mt-6">
          <Link className="browse-action" to={offerPagePath(page - 1)}>← Previous page</Link>
          {end < offers.length && <Link className="browse-action" to={offerPagePath(page + 1)}>Next page →</Link>}
        </nav>
      </>}
    </section>
  )
}
