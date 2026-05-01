import MetaTags from '@/components/seo/MetaTags'
import CardSelector from '@/components/cards/CardSelector'
import SelectedCardsList from '@/components/cards/SelectedCardsList'
import { useSelectedCards } from '@/hooks/useSelectedCards'
import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight } from 'lucide-react'

export default function MyCardsPage() {
  const { selectedCards, addCard, removeCard, hasCard } = useSelectedCards()

  return (
    <>
      <MetaTags
        title="My Cards"
        description="Add your Sri Lankan credit and debit cards to see promotions matched to your bank and card type. No sensitive information required."
        noIndex
      />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Heading */}
        <div>
          <h1 className="text-xl font-bold text-content">My Cards</h1>
          <p className="text-sm text-muted mt-0.5">
            Add your cards to see matched promotions
          </p>
        </div>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <ShieldCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-800 leading-relaxed">
            We never ask for card numbers, CVV, or PIN. Only non-sensitive
            details like bank name and card type are stored locally in your
            browser.
          </p>
        </div>

        {/* Card selector */}
        <CardSelector onAdd={addCard} hasCard={hasCard} />

        {/* Selected cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-content">
              Your Cards
              {selectedCards.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted">
                  ({selectedCards.length})
                </span>
              )}
            </h2>
          </div>
          <SelectedCardsList cards={selectedCards} onRemove={removeCard} />
        </div>

        {/* CTA when cards are selected */}
        {selectedCards.length > 0 && (
          <Link
            to="/?myCardsOnly=true"
            className="flex items-center justify-center gap-2 w-full bg-primary text-white
              py-3 rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
          >
            View my matched promotions
            <ArrowRight size={15} />
          </Link>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted leading-relaxed text-center pb-2">
          Promotion information is collected from public sources and may change
          without notice. Please verify offer details with the relevant bank or
          merchant before making a purchase.
        </p>
      </div>
    </>
  )
}
