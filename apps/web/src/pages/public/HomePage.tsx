import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { WebsiteStructuredData } from '@/components/seo/StructuredData'
import OfferFilters from '@/components/offers/OfferFilters'
import OfferGrid from '@/components/offers/OfferGrid'
import BankNav from '@/components/offers/BankNav'
import InlineCardManager from '@/components/cards/InlineCardManager'
import { useOfferFilters } from '@/hooks/useOfferFilters'
import { usePublicBrowseData } from '@/hooks/usePublicBrowseData'
import { useSelectedCards } from '@/hooks/useSelectedCards'
import { canonicalUrl } from '@/utils/seo'

interface HomePageProps {
  routeMode?: 'home' | 'offers'
}

export default function HomePage({ routeMode = 'home' }: HomePageProps) {
  const { selectedCards, addCard, removeCard, hasCard } = useSelectedCards()
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
        description="Credit and debit card promotions in Sri Lanka from HNB, Commercial Bank, Sampath, BOC and more. Find dining, shopping, travel and supermarket card offers."
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

        <InlineCardManager
          selectedCards={selectedCards}
          banks={banks}
          onAdd={addCard}
          onRemove={removeCard}
          hasCard={hasCard}
          myCardsOnly={filters.myCardsOnly}
          onToggleMyCards={(next) => setFilter('myCardsOnly', next)}
        />

        <BankNav banks={banks} loading={loading} />

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
