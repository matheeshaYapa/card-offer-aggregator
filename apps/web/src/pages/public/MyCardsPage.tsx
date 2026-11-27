import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Plus, X, ChevronDown } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { useSelectedCards } from '@/hooks/useSelectedCards'
import { getBanks } from '@/lib/supabase/queries/banks'
import { getCards } from '@/lib/supabase/queries/cards'
import { formatCardTypeName, formatNetworkName } from '@/utils/normalization'
import { getBankTheme } from '@/utils/bankTheme'
import type { Bank, Card } from '@/types'

const SELECT_CLASS =
  'w-full min-h-11 appearance-none bg-bg-base border border-border rounded-xl px-3 py-2.5 pr-9 ' +
  'text-base text-content focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:opacity-50'

export default function MyCardsPage() {
  const { selectedCards, addCard, removeCard, hasCard } = useSelectedCards()
  const [banks, setBanks] = useState<Bank[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [bankId, setBankId] = useState('')
  const [cardId, setCardId] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBanks().then(setBanks).catch((e) =>
      setError(e instanceof Error ? e.message : 'Failed to load banks'),
    )
    getCards().then(setCards).catch((e) =>
      setError(e instanceof Error ? e.message : 'Failed to load cards'),
    )
  }, [])

  const availableCards = useMemo(
    () => cards.filter((c) => !hasCard(c.id) && (!bankId || c.bank_id === bankId)),
    [cards, hasCard, bankId],
  )

  function handleAdd() {
    const card = availableCards.find((c) => c.id === cardId)
    if (!card) return
    addCard(card)
    setCardId('')
  }

  const bankSlugById = (id: string) => banks.find((b) => b.id === id)?.slug ?? null

  return (
    <>
      <MetaTags
        title="My Cards"
        description="Add your Sri Lankan credit and debit cards to see promotions matched to your bank and card type. No sensitive information required."
        noIndex
      />

      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 flex flex-col gap-5">
        {/* Heading */}
        <div>
          <h1 className="text-4xl tracking-tight font-extrabold text-content">My Cards</h1>
          <p className="text-base text-muted mt-2">Find promotions for the cards you use.</p>
        </div>

        {/* Privacy note */}
        <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-3">
          <ShieldCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-800 leading-relaxed">
            Your selections stay in this browser. Choose your bank and card type.
          </p>
        </div>

        {error && (
          <p className="text-xs text-danger bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* Add card */}
        <div className="bg-white border border-border rounded-2xl p-[18px]">
          <h2 className="text-base font-bold text-content mb-3">Add a card</h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[150px]">
              <select
                aria-label="Bank"
                value={bankId}
                onChange={(e) => { setBankId(e.target.value); setCardId('') }}
                className={SELECT_CLASS}
              >
                <option value="">Choose a bank</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-[170px]">
              <select
                aria-label="Card"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                disabled={availableCards.length === 0}
                className={SELECT_CLASS}
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

            <button
              type="button"
              onClick={handleAdd}
              disabled={!cardId}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white rounded-[10px] text-sm font-bold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </div>

        {/* Selected cards */}
        <div>
          <h2 className="text-base font-bold text-content mb-2.5">
            Your Cards
            {selectedCards.length > 0 && (
              <span className="font-normal text-muted"> ({selectedCards.length})</span>
            )}
          </h2>

          {selectedCards.length === 0 ? (
            <p className="text-sm text-muted text-center py-5">
              No cards added yet — choose a bank and card above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedCards.map((card) => {
                const theme = getBankTheme(bankSlugById(card.bank_id))
                return (
                  <div
                    key={card.id}
                    className="flex items-center gap-3 bg-white border border-border rounded-xl px-3.5 py-3"
                  >
                    <span
                      className={`w-[34px] h-6 rounded-[5px] ${theme.stripe} shrink-0 flex items-end p-[3px]`}
                      aria-hidden="true"
                    >
                      <span className="w-2.5 h-[7px] rounded-[2px] bg-white/55" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-content truncate">
                        {card.bank_name || card.bank_short_name}
                      </p>
                      <p className="text-xs text-muted">
                        {formatNetworkName(card.network)} {formatCardTypeName(card.card_type)} · {card.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCard(card.id)}
                      className="size-11 rounded-lg text-muted hover:bg-red-50 hover:text-danger flex items-center justify-center transition-colors"
                      aria-label={`Remove ${card.bank_short_name} ${card.name}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* CTA */}
        {selectedCards.length > 0 && (
          <Link
            to="/offers?myCardsOnly=true"
            className="flex items-center justify-center gap-2 w-full bg-primary text-white py-3.5 rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors"
          >
            View my matched promotions
          </Link>
        )}

        {/* Disclaimer */}
        <p className="text-[11px] text-muted leading-relaxed text-center">
          Promotion information is collected from public sources and may change
          without notice. Please verify offer details with the relevant bank or
          merchant before making a purchase.
        </p>
      </div>
    </>
  )
}
