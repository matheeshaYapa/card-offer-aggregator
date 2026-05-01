import type { Offer } from '@/types'
import OfferCard from './OfferCard'
import EmptyState from '@/components/common/EmptyState'
import { SearchX, Tags } from 'lucide-react'

interface OfferGridProps {
  offers: Offer[]
  showCount?: boolean
}

export default function OfferGrid({ offers, showCount = true }: OfferGridProps) {
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
          <span>
            {offers.length} promotion{offers.length !== 1 ? 's' : ''} found
          </span>
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
