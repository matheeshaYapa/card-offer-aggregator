import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { OFFERS_PER_PAGE as PAGE_SIZE, offerPagePath } from '@/utils/offerPagination'
import type { Offer } from '@/types'
import OfferCard from './OfferCard'
import EmptyState from '@/components/common/EmptyState'
import { SearchX, Tags } from 'lucide-react'

interface OfferGridProps {
  offers: Offer[]
  loading?: boolean
  showCount?: boolean
  compact?: boolean
  emptyAction?: () => void
}

function SkeletonCard() {
  return (
    <div aria-hidden="true" className="bg-white rounded-2xl border border-border p-5 motion-safe:animate-pulse min-h-[240px] flex flex-col">
      <div className="h-7 w-24 bg-slate-200 rounded mb-3" />
      <div className="h-4 bg-slate-100 rounded w-3/4 mb-1.5" />
      <div className="h-4 bg-slate-100 rounded w-1/2 mb-3" />
      <div className="flex gap-1.5">
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
        <div className="h-5 w-12 bg-slate-100 rounded-full" />
      </div>
      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
        <div className="h-3 w-20 bg-slate-100 rounded" />
        <div className="h-3 w-3 bg-slate-100 rounded" />
      </div>
    </div>
  )
}

export default function OfferGrid({
  offers,
  loading = false,
  showCount = true,
  compact = false,
  emptyAction,
}: OfferGridProps) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const { pathname, search } = useLocation()

  // Reset paging whenever the result set changes (new data, filters, search).
  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [offers])

  const showEmpty = !loading && offers.length === 0
  const shown = loading ? [] : offers.slice(0, visible)
  const remaining = offers.length - shown.length

  return (
    // Reserve vertical space so the page height is stable from first paint
    // through data load (prevents the large cumulative layout shift).
    <div className="min-h-[60vh]">
      {showCount && (
        <div role="status" className="flex items-center gap-2 text-sm text-muted mb-4 min-h-5">
          <Tags size={13} />
          <span>
            {loading
              ? 'Loading promotions…'
              : `${offers.length} promotion${offers.length !== 1 ? 's' : ''} found`}
          </span>
        </div>
      )}

      {showEmpty ? (
        <EmptyState
          icon={<SearchX size={24} />}
          title="No matching promotions found"
          description={emptyAction ? 'Try a different search or clear your filters.' : 'Check back for new promotions.'}
          action={emptyAction && <button type="button" onClick={emptyAction} className="browse-action">Clear filters</button>}
        />
      ) : (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${compact ? 'xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4'}`}>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : shown.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          </div>

          {!loading && remaining > 0 && (
            <div className="flex justify-center mt-6">
              {pathname === '/offers' && !search ? (
                <Link className="browse-action" to={offerPagePath(2)}>Next page →</Link>
              ) : (
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="px-5 py-2.5 rounded-xl border border-border bg-white text-sm font-semibold text-content hover:border-primary/40 hover:text-primary transition-colors"
                >
                  Load more
                  <span className="text-muted font-normal"> ({remaining} more)</span>
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
