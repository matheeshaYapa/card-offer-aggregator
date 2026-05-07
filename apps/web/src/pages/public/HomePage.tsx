import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, Info, Wallet } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { WebsiteStructuredData } from '@/components/seo/StructuredData'
import OfferFilters from '@/components/offers/OfferFilters'
import OfferGrid from '@/components/offers/OfferGrid'
import { useOfferFilters } from '@/hooks/useOfferFilters'
import { usePublicBrowseData } from '@/hooks/usePublicBrowseData'
import { useSelectedCards } from '@/hooks/useSelectedCards'

interface HomePageProps {
  routeMode?: 'home' | 'offers'
}

export default function HomePage({ routeMode = 'home' }: HomePageProps) {
  const { selectedCards } = useSelectedCards()
  const [searchParams] = useSearchParams()
  const { offers, banks, categories, merchants, loading, error, reload } =
    usePublicBrowseData()

  const { filters, setFilter, resetFilters, filteredOffers, activeFilterCount } =
    useOfferFilters(offers, selectedCards)

  useEffect(() => {
    setFilter('myCardsOnly', searchParams.get('myCardsOnly') === 'true')
  }, [searchParams, setFilter])

  const isOffersRoute = routeMode === 'offers'

  return (
    <>
      <MetaTags
        title={
          isOffersRoute
            ? 'All Card Offers Sri Lanka'
            : 'Credit & Debit Card Promotions Sri Lanka'
        }
        description="Discover the best credit and debit card promotions in Sri Lanka. Compare offers from Commercial Bank, HNB, Sampath, BOC, People's Bank and more."
      />
      <WebsiteStructuredData />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-content">
            {isOffersRoute ? 'All Card Offers' : 'Card Promotions Sri Lanka'}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Browse offers for your credit &amp; debit cards
          </p>
        </div>

        {selectedCards.length === 0 && (
          <Link
            to="/my-cards"
            className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-5 hover:bg-primary/10 transition-colors"
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
              <Link
                to="/my-cards"
                className="text-primary underline underline-offset-2"
              >
                Manage cards
              </Link>
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1 min-w-0">{error}</span>
            <button
              onClick={() => void reload()}
              className="text-xs font-medium underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        <OfferFilters
          filters={filters}
          onChange={setFilter}
          onReset={resetFilters}
          activeFilterCount={activeFilterCount}
          selectedCardCount={selectedCards.length}
          banks={banks}
          categories={categories}
          merchants={merchants}
        />

        <OfferGrid offers={filteredOffers} loading={loading} />
      </div>
    </>
  )
}
