import type { Offer } from '@/types'
import OfferCard from './OfferCard'
import EmptyState from '@/components/common/EmptyState'
import { SearchX, Tags } from 'lucide-react'

interface OfferGridProps {
  offers: Offer[]
  loading?: boolean
  showCount?: boolean
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden animate-pulse">
      <div className="h-12 bg-slate-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="flex gap-1.5 mt-3">
          <div className="h-5 w-16 bg-slate-100 rounded-full" />
          <div className="h-5 w-12 bg-slate-100 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function OfferGrid({
  offers,
  loading = false,
  showCount = true,
}: OfferGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (offers.length === 0) {
    return (
      <EmptyState
        icon={<SearchX size={24} />}
        title="No matching promotions found"
        description="Try changing your filters or removing selected cards to see more offers."
      />
    )
  }

  return (
    <div>
      {showCount && (
        <div className="flex items-center gap-1.5 text-xs text-muted mb-4">
          <Tags size={13} />
          <span>{offers.length} promotion{offers.length !== 1 ? 's' : ''} found</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </div>
  )
}
