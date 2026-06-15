import { useEffect, useState } from 'react'
import type { Offer } from '@/types'
import OfferCard from './OfferCard'
import EmptyState from '@/components/common/EmptyState'
import { SearchX, Tags } from 'lucide-react'

interface OfferGridProps {
  offers: Offer[]
  loading?: boolean
  showCount?: boolean
}

/** How many cards to render per page. Keeps the DOM small to avoid the heavy
 * forced-reflow / layout-shift cost of mounting hundreds of cards at once. */
const PAGE_SIZE = 24

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-border p-4 pl-5 animate-pulse min-h-[210px] flex flex-col">
      <div className="h-6 w-28 bg-slate-200 rounded-lg mb-3" />
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
}: OfferGridProps) {
  const [visible, setVisible] = useState(PAGE_SIZE)

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
        <div className="flex items-center gap-1.5 text-xs text-muted mb-4 h-5">
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
          description="Try changing your filters or removing selected cards to see more offers."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : shown.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          </div>

          {!loading && remaining > 0 && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="px-5 py-2.5 rounded-xl border border-border bg-white text-sm font-semibold text-content hover:border-primary/40 hover:text-primary transition-colors"
              >
                Load more
                <span className="text-muted font-normal"> ({remaining} more)</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
