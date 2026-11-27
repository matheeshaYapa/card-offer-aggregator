import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CreditCard, Globe2, Wallet } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { WebsiteStructuredData } from '@/components/seo/StructuredData'
import SearchInput from '@/components/common/SearchInput'
import OfferFilters from '@/components/offers/OfferFilters'
import OfferGrid from '@/components/offers/OfferGrid'
import BankNav from '@/components/offers/BankNav'
import InlineCardManager from '@/components/cards/InlineCardManager'
import { useOfferFilters } from '@/hooks/useOfferFilters'
import { usePublicBrowseData } from '@/hooks/usePublicBrowseData'
import { useSelectedCards } from '@/hooks/useSelectedCards'
import { getOfferBanks } from '@/utils/offerMatching'
import { canonicalUrl } from '@/utils/seo'

interface HomePageProps {
  routeMode?: 'home' | 'offers'
}

export default function HomePage({ routeMode = 'home' }: HomePageProps) {
  const { selectedCards, removeCard } = useSelectedCards()
  const { offers, banks, categories, loading, error, reload } = usePublicBrowseData()
  const { filters, setFilter, resetFilters, filteredOffers, activeFilterCount } =
    useOfferFilters(offers, selectedCards)

  const offerCountBySlug = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const offer of offers) {
      for (const bank of getOfferBanks(offer)) {
        counts[bank.slug] = (counts[bank.slug] ?? 0) + 1
      }
    }
    return counts
  }, [offers])

  const isOffersRoute = routeMode === 'offers'
  const coveredBanks = Object.keys(offerCountBySlug).length
  const visibleOffers = filters.myCardsOnly && selectedCards.length === 0 ? [] : filteredOffers

  return (
    <>
      <MetaTags
        title={isOffersRoute ? 'All Card Offers Sri Lanka' : 'Credit & Debit Card Promotions Sri Lanka'}
        description="Find credit and debit card offers across Sri Lanka. Browse dining, travel, shopping and supermarket promotions and filter by the cards you already have."
        canonical={canonicalUrl(isOffersRoute ? '/offers' : '/')}
      />
      <WebsiteStructuredData />

      <div className="browse-shell">
        <section className="browse-hero" aria-labelledby="browse-heading">
          <div className="browse-hero-copy">
            <p className="browse-eyebrow"><Globe2 size={16} aria-hidden="true" /> Sri Lanka · Card offers</p>
            <h1 id="browse-heading">Find more with<br className="hidden sm:block" /> the <em>cards you have.</em></h1>
            <p className="browse-hero-intro">Find dining, shopping and travel deals from Sri Lankan banks. Save your cards to see which offers you can use.</p>
            <div className="browse-search" role="search" aria-label="Card offers">
              <SearchInput
                value={filters.search}
                onChange={(value) => setFilter('search', value)}
                placeholder="Search offers, merchants or banks"
              />
            </div>
          </div>
          <div className="hero-card-art" aria-hidden="true">
            <div className="hero-orbit hero-orbit-outer" />
            <div className="hero-orbit hero-orbit-inner" />
            <div className="hero-card hero-card-back"><CreditCard size={34} strokeWidth={1.4} /></div>
            <div className="hero-card hero-card-front">
              <span className="hero-card-chip" />
              <span className="hero-card-brand">CardPromo<span>LK</span></span>
              <span className="hero-card-digits">•••• &nbsp; •••• &nbsp; ••••</span>
              <span className="hero-card-circles" />
            </div>
          </div>
        </section>

        <section id="offers" className="browse-results" aria-labelledby="results-heading">
          <div className="browse-results-heading">
            <div>
              <h2 id="results-heading">Explore offers</h2>
              {!loading && !error && (
                <p>{offers.length.toLocaleString('en-LK')} available {offers.length === 1 ? 'offer' : 'offers'} from {coveredBanks} {coveredBanks === 1 ? 'bank' : 'banks'}</p>
              )}
            </div>
            <a href="#browse-banks" className="browse-directory-link" hidden={banks.length === 0}>Browse by bank</a>
          </div>

          <div className="browse-workspace">
            <aside aria-label="Offer preferences" className="browse-sidebar">
              <InlineCardManager
                selectedCards={selectedCards}
                banks={banks}
                onRemove={removeCard}
                myCardsOnly={filters.myCardsOnly}
                onToggleMyCards={(next) => setFilter('myCardsOnly', next)}
              />
              <OfferFilters
                filters={filters}
                onChange={setFilter}
                onReset={resetFilters}
                activeFilterCount={activeFilterCount}
                banks={banks}
              />
            </aside>

            <div className="min-w-0">
              <div className="browse-categories" role="group" aria-label="Offer category">
                <button type="button" aria-pressed={!filters.categorySlug} onClick={() => setFilter('categorySlug', null)}>All categories</button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={filters.categorySlug === category.slug}
                    onClick={() => setFilter('categorySlug', filters.categorySlug === category.slug ? null : category.slug)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
              {error ? (
                <div className="browse-feedback" role="alert">
                  <AlertCircle size={25} aria-hidden="true" />
                  <h3>Offers are temporarily unavailable</h3>
                  <p>Reload to try again.</p>
                  <button type="button" className="browse-action" onClick={() => void reload()}>Reload offers</button>
                </div>
              ) : filters.myCardsOnly && selectedCards.length === 0 ? (
                <div className="browse-feedback">
                  <Wallet size={25} aria-hidden="true" />
                  <h3>Add a card to see matches</h3>
                  <p>Choose the cards you use to find offers that apply to you.</p>
                  <Link to="/my-cards" className="browse-action">Add a card</Link>
                </div>
              ) : (
                <OfferGrid
                  offers={visibleOffers}
                  loading={loading}
                  compact
                  emptyAction={activeFilterCount > 0 ? resetFilters : undefined}
                />
              )}
            </div>
          </div>
        </section>

        {banks.length > 0 && (
          <section id="browse-banks" className="browse-bank-directory" aria-label="Bank directory">
            <BankNav banks={banks} offerCountBySlug={offerCountBySlug} />
          </section>
        )}
      </div>
    </>
  )
}
