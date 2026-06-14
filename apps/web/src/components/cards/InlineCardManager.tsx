import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Plus, X, ChevronDown, Settings2 } from 'lucide-react'
import type { Bank, Card, SelectedCard } from '@/types'
import { getCards } from '@/lib/supabase/queries/cards'
import { formatCardTypeName, formatNetworkName } from '@/utils/normalization'
import { getBankTheme } from '@/utils/bankTheme'

interface InlineCardManagerProps {
  selectedCards: SelectedCard[]
  banks: Bank[]
  onAdd: (card: Card) => void
  onRemove: (cardId: string) => void
  hasCard: (cardId: string) => boolean
  myCardsOnly: boolean
  onToggleMyCards: (next: boolean) => void
}

/**
 * Compact card personalisation bar shown at the top of the offers dashboard.
 * Lets users add/remove their cards inline (without leaving for /my-cards) and
 * toggle "My cards only" right next to their cards — keeping the core journey
 * (browse → filter to my cards) on a single page.
 */
export default function InlineCardManager({
  selectedCards,
  banks,
  onAdd,
  onRemove,
  hasCard,
  myCardsOnly,
  onToggleMyCards,
}: InlineCardManagerProps) {
  const hasCards = selectedCards.length > 0
  const [adding, setAdding] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [bankId, setBankId] = useState('')
  const [cardId, setCardId] = useState('')

  // Lazy-load the card catalogue the first time the add form is opened.
  useEffect(() => {
    if (!adding || cards.length > 0) return
    getCards()
      .then(setCards)
      .catch(() => setCards([]))
  }, [adding, cards.length])

  // Reset the chosen card whenever the bank filter changes.
  useEffect(() => setCardId(''), [bankId])

  const availableCards = useMemo(
    () =>
      cards.filter(
        (c) => !hasCard(c.id) && (!bankId || c.bank_id === bankId),
      ),
    [cards, hasCard, bankId],
  )

  function handleAdd() {
    const card = availableCards.find((c) => c.id === cardId)
    if (!card) return
    onAdd(card)
    setCardId('')
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-4 mb-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Wallet size={15} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-content leading-tight">
              Your cards
              {hasCards && (
                <span className="ml-1.5 text-xs font-normal text-muted">
                  ({selectedCards.length})
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted leading-tight">
              {hasCards
                ? 'Filter offers to the cards you own'
                : 'Add your cards to personalise offers'}
            </p>
          </div>
        </div>

        {hasCards && (
          <button
            type="button"
            onClick={() => onToggleMyCards(!myCardsOnly)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              myCardsOnly
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-muted border-border hover:border-primary/40'
            }`}
          >
            {myCardsOnly ? '✓ ' : ''}My cards only
          </button>
        )}
      </div>

      {/* Selected card chips */}
      {hasCards && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedCards.map((card) => {
            const theme = getBankTheme(bankSlugOf(card, banks))
            return (
              <span
                key={card.id}
                className="inline-flex items-center gap-1.5 bg-slate-50 border border-border rounded-full pl-2.5 pr-1 py-1 text-xs"
              >
                <span className={`w-2 h-2 rounded-full ${theme.stripe}`} />
                <span className="font-medium text-content">
                  {card.bank_short_name}
                </span>
                <span className="text-muted">
                  {formatNetworkName(card.network)} {formatCardTypeName(card.card_type)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(card.id)}
                  className="w-5 h-5 rounded-full hover:bg-red-50 flex items-center justify-center text-muted hover:text-danger transition-colors"
                  aria-label={`Remove ${card.bank_short_name} ${card.name}`}
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Add form / actions */}
      {adding ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-border rounded-xl px-3 py-2 text-sm text-content focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">All banks</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.short_name ?? b.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>

          <div className="relative flex-1">
            <select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              disabled={availableCards.length === 0}
              className="w-full appearance-none bg-slate-50 border border-border rounded-xl px-3 py-2 text-sm text-content focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
            >
              <option value="">
                {availableCards.length === 0 ? 'No cards available' : 'Choose a card'}
              </option>
              {availableCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.bank?.short_name ?? c.bank?.name ?? '') + ' – ' + c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!cardId}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={15} />
              Add
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-2 text-sm text-muted hover:text-content rounded-xl hover:bg-slate-100 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus size={14} />
            Add a card
          </button>
          <Link
            to="/my-cards"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-content transition-colors"
          >
            <Settings2 size={13} />
            Manage all
          </Link>
        </div>
      )}
    </div>
  )
}

/** Resolve a selected card's bank slug from the loaded banks list (for theming). */
function bankSlugOf(card: SelectedCard, banks: Bank[]): string | null {
  return banks.find((b) => b.id === card.bank_id)?.slug ?? null
}
