import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, PlusCircle } from 'lucide-react'
import type { Bank, Card, CardNetwork, CardType } from '@/types'
import Badge from '@/components/common/Badge'
import { formatCardTypeName, formatNetworkName } from '@/utils/normalization'
import { getBanks } from '@/lib/supabase/queries/banks'
import { getCards } from '@/lib/supabase/queries/cards'

interface CardSelectorProps {
  onAdd: (card: Card) => void
  hasCard: (cardId: string) => boolean
}

export default function CardSelector({ onAdd, hasCard }: CardSelectorProps) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [selectedBankId, setSelectedBankId] = useState('')
  const [selectedCardType, setSelectedCardType] = useState<CardType | ''>('')
  const [selectedNetwork, setSelectedNetwork] = useState<CardNetwork | ''>('')
  const [selectedCardId, setSelectedCardId] = useState('')
  const [loadingBanks, setLoadingBanks] = useState(true)
  const [loadingCards, setLoadingCards] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBanks()
      .then(setBanks)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load banks')
      })
      .finally(() => setLoadingBanks(false))
  }, [])

  useEffect(() => {
    getCards()
      .then(setCards)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load cards')
      })
      .finally(() => setLoadingCards(false))
  }, [])

  useEffect(() => {
    setSelectedCardId('')
  }, [selectedBankId, selectedCardType, selectedNetwork])

  const availableCards = useMemo(
    () =>
      cards.filter((card) => {
        if (hasCard(card.id)) return false
        if (selectedBankId && card.bank_id !== selectedBankId) return false
        if (selectedCardType && card.card_type !== selectedCardType) return false
        if (selectedNetwork && card.network !== selectedNetwork) return false
        return true
      }),
    [cards, hasCard, selectedBankId, selectedCardType, selectedNetwork],
  )

  const selectedCard = availableCards.find((card) => card.id === selectedCardId)

  function handleAddCard() {
    if (!selectedCard) return
    onAdd(selectedCard)
    setSelectedCardId('')
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-content mb-4">Add a Card</h2>

      {error && (
        <p className="text-xs text-danger bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">
            Select your bank
          </label>
          <div className="relative">
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              disabled={loadingBanks}
              className="w-full appearance-none bg-slate-50 border border-border rounded-xl px-3 py-2.5
                text-sm text-content focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                transition-colors disabled:opacity-50"
            >
              <option value="">All banks</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">
            Card type
          </label>
          <div className="relative">
            <select
              value={selectedCardType}
              onChange={(e) => setSelectedCardType(e.target.value as CardType | '')}
              disabled={loadingCards}
              className="w-full appearance-none bg-slate-50 border border-border rounded-xl px-3 py-2.5
                text-sm text-content focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                transition-colors disabled:opacity-50"
            >
              <option value="">All card types</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">
            Card network
          </label>
          <div className="relative">
            <select
              value={selectedNetwork}
              onChange={(e) =>
                setSelectedNetwork(e.target.value as CardNetwork | '')
              }
              disabled={loadingCards}
              className="w-full appearance-none bg-slate-50 border border-border rounded-xl px-3 py-2.5
                text-sm text-content focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                transition-colors disabled:opacity-50"
            >
              <option value="">All networks</option>
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="amex">Amex</option>
              <option value="other">Other</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">
            Select card
          </label>
          <div className="relative">
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              disabled={loadingCards || availableCards.length === 0}
              className="w-full appearance-none bg-slate-50 border border-border rounded-xl px-3 py-2.5
                text-sm text-content focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                transition-colors disabled:opacity-50"
            >
              <option value="">
                {loadingCards
                  ? 'Loading cards…'
                  : availableCards.length === 0
                    ? 'No matching cards available'
                    : 'Choose a card'}
              </option>
              {availableCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
          </div>
        </div>
      </div>

      {selectedCard && (
        <div className="mt-4 rounded-xl bg-slate-50 border border-border p-3">
          <p className="text-sm font-medium text-content">{selectedCard.name}</p>
          <div className="flex gap-1.5 mt-2">
            <Badge
              variant={selectedCard.card_type === 'credit' ? 'credit' : 'debit'}
              size="sm"
            >
              {formatCardTypeName(selectedCard.card_type)}
            </Badge>
            <Badge
              variant={
                selectedCard.network as 'visa' | 'mastercard' | 'amex' | 'other'
              }
              size="sm"
            >
              {formatNetworkName(selectedCard.network)}
            </Badge>
          </div>
        </div>
      )}

      <button
        onClick={handleAddCard}
        disabled={!selectedCard}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-3
          text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <PlusCircle size={16} />
        Add selected card
      </button>
    </div>
  )
}
