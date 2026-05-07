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
import { canonicalUrl } from '@/utils/seo'

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
  const pageCanonical = canonicalUrl(isOffersRoute ? '/offers' : '/')

  return (
    <>
      <MetaTags
        title={
          isOffersRoute
            ? 'All Card Offers Sri Lanka'
            : 'Credit & Debit Card Promotions Sri Lanka'
        }
        description="Discover the best credit and debit card promotions in Sri Lanka. Compare offers from Commercial Bank, HNB, Sampath, BOC, People's Bank and more — dining, shopping, travel, supermarket and online deals."
        canonical={pageCanonical}
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

        {/* SEO content section — visible text for crawlers, useful for new visitors */}
        {!isOffersRoute && !loading && (
          <section className="mt-12 pt-8 border-t border-border" aria-label="About CardPromo LK">
            <div className="max-w-3xl">
              <h2 className="text-base font-semibold text-content mb-3">
                Find the best card offers in Sri Lanka
              </h2>
              <p className="text-sm text-muted leading-relaxed mb-3">
                CardPromo LK brings together credit card offers and debit card
                promotions from Sri Lanka's leading banks — including{' '}
                <Link to="/bank/commercial-bank" className="text-primary hover:underline">
                  Commercial Bank
                </Link>
                ,{' '}
                <Link to="/bank/hnb" className="text-primary hover:underline">
                  HNB
                </Link>
                ,{' '}
                <Link to="/bank/sampath-bank" className="text-primary hover:underline">
                  Sampath Bank
                </Link>
                ,{' '}
                <Link to="/bank/boc" className="text-primary hover:underline">
                  BOC
                </Link>{' '}
                and more — in one easy-to-search place.
              </p>
              <p className="text-sm text-muted leading-relaxed mb-4">
                Browse dining offers, supermarket cashback, travel discounts, online
                shopping deals and lifestyle promotions, all updated regularly. Add
                your cards once and we'll highlight the offers that apply to you.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Dining offers', to: '/category/dining' },
                  { label: 'Supermarket deals', to: '/category/supermarket' },
                  { label: 'Travel promotions', to: '/category/travel' },
                  { label: 'Shopping discounts', to: '/category/shopping' },
                ].map(({ label, to }) => (
                  <Link
                    key={to}
                    to={to}
                    className="text-xs text-primary border border-primary/30 rounded-full px-3 py-1 hover:bg-primary/5 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
