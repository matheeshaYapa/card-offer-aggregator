import { Link } from 'react-router-dom'
import { AlertCircle, Wallet } from 'lucide-react'
import type { Bank, Category, Offer } from '@/types'
import InlineCardManager from '@/components/cards/InlineCardManager'
import OfferFilters from './OfferFilters'
import OfferGrid from './OfferGrid'
import OfferToolbar from './OfferToolbar'
import CategoryChips from './CategoryChips'
import { useOfferFilters } from '@/hooks/useOfferFilters'
import { useSelectedCards } from '@/hooks/useSelectedCards'

interface OfferBrowserProps {
  offers: Offer[]
  banks: Bank[]
  categories: Category[]
  loading: boolean
  error: string | null
  reload: () => void
  /** Fix the bank or category for landing pages; the matching control is hidden. */
  lockedBank?: string
  lockedCategory?: string
}

/**
 * The offer browsing workspace shared by the home, bank and category pages:
 * cards + filters sidebar, category chips, offer-type chips, sort and grid.
 * All state lives in the URL, so filtered views can be shared and bookmarked.
 */
export default function OfferBrowser({
  offers, banks, categories, loading, error, reload, lockedBank, lockedCategory,
}: OfferBrowserProps) {
  const { selectedCards, removeCard } = useSelectedCards()
  const locked = { ...(lockedBank && { bankSlug: lockedBank }), ...(lockedCategory && { categorySlug: lockedCategory }) }
  const {
    filters, setFilter, resetFilters, filteredOffers, activeFilterCount,
    categoryCounts, totalBeforeCategory, typeCounts, totalBeforeType, endingSoonCount,
  } = useOfferFilters(offers, selectedCards, { locked })
  const needsCards = filters.myCardsOnly && selectedCards.length === 0

  return (
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
          hideBank={Boolean(lockedBank)}
        />
      </aside>

      <div className="min-w-0">
        {!lockedCategory && (
          <CategoryChips
            categories={categories}
            counts={categoryCounts}
            total={totalBeforeCategory}
            selected={filters.categorySlug}
            onSelect={(slug) => setFilter('categorySlug', slug)}
            loading={loading}
          />
        )}
        <OfferToolbar
          filters={filters}
          onChange={setFilter}
          typeCounts={typeCounts}
          totalBeforeType={totalBeforeType}
          resultCount={needsCards ? 0 : filteredOffers.length}
          endingSoonCount={endingSoonCount}
          loading={loading}
        />
        {error ? (
          <div className="browse-feedback" role="alert">
            <AlertCircle size={25} aria-hidden="true" />
            <h3>Offers are temporarily unavailable</h3>
            <p>Reload to try again.</p>
            <button type="button" className="browse-action" onClick={reload}>Reload offers</button>
          </div>
        ) : needsCards ? (
          <div className="browse-feedback">
            <Wallet size={25} aria-hidden="true" />
            <h3>Add a card to see matches</h3>
            <p>Choose the cards you use to find offers that apply to you.</p>
            <Link to="/my-cards" className="browse-action">Add a card</Link>
          </div>
        ) : (
          <OfferGrid
            offers={filteredOffers}
            loading={loading}
            showCount={false}
            compact
            emptyAction={activeFilterCount > 0 ? resetFilters : undefined}
          />
        )}
      </div>
    </div>
  )
}
