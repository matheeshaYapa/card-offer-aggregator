import MetaTags from '@/components/seo/MetaTags'
import { WebsiteStructuredData } from '@/components/seo/StructuredData'
import OfferFilters from '@/components/offers/OfferFilters'
import OfferGrid from '@/components/offers/OfferGrid'
import { useOfferFilters } from '@/hooks/useOfferFilters'
import { useSelectedCards } from '@/hooks/useSelectedCards'
import offersData from '@/data/offers.json'
import type { Offer } from '@/types'
import { Link } from 'react-router-dom'
import { Wallet, Info } from 'lucide-react'

export default function HomePage() {
  const { selectedCards } = useSelectedCards()
  const { filters, setFilter, resetFilters, filteredOffers, activeFilterCount } =
    useOfferFilters(offersData as Offer[], selectedCards)

  return (
    <>
      <MetaTags
        title="Credit & Debit Card Promotions Sri Lanka"
        description="Discover the best credit and debit card promotions in Sri Lanka. Compare offers from Commercial Bank, HNB, Sampath, BOC, People's Bank and more. Find dining, shopping, travel and supermarket deals."
      />
      <WebsiteStructuredData />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page heading */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-content">
            Card Promotions Sri Lanka
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Browse offers for your credit &amp; debit cards
          </p>
        </div>

        {/* My-cards nudge (shown when no cards selected) */}
        {selectedCards.length === 0 && (
          <Link
            to="/my-cards"
            className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-5
              hover:bg-primary/10 transition-colors"
          >
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Wallet size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-content">Add your cards</p>
              <p className="text-xs text-muted">
                See offers matched to your specific bank cards
              </p>
            </div>
            <span className="text-xs text-primary font-medium shrink-0">
              Set up →
            </span>
          </Link>
        )}

        {/* Active cards summary */}
        {selectedCards.length > 0 && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 mb-5">
            <Info size={14} className="text-primary shrink-0" />
            <p className="text-xs text-muted">
              Showing offers for{' '}
              <span className="font-semibold text-content">
                {selectedCards.length} selected card
                {selectedCards.length !== 1 ? 's' : ''}
              </span>
              .{' '}
              <Link to="/my-cards" className="text-primary underline underline-offset-2">
                Manage cards
              </Link>
            </p>
          </div>
        )}

        <OfferFilters
          filters={filters}
          onChange={setFilter}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
          selectedCardCount={selectedCards.length}
        />

        <OfferGrid offers={filteredOffers} />
      </div>
    </>
  )
}
