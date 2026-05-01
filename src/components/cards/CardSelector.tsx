import { useState } from 'react'
import { PlusCircle, ChevronDown } from 'lucide-react'
import type { Card } from '@/types'
import Badge from '@/components/common/Badge'
import { formatNetworkName, formatCardTypeName } from '@/utils/normalization'
import banksData from '@/data/banks.json'
import cardsData from '@/data/cards.json'

interface CardSelectorProps {
  onAdd: (card: Card) => void
  hasCard: (cardId: string) => boolean
}

export default function CardSelector({ onAdd, hasCard }: CardSelectorProps) {
  const [selectedBankId, setSelectedBankId] = useState('')

  const availableCards = selectedBankId
    ? (cardsData as Card[]).filter(
        (c) => c.bankId === selectedBankId && !hasCard(c.id),
      )
    : []

  return (
    <div className="bg-white border border-border rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-content mb-4">Add a Card</h2>

      {/* Bank selector */}
      <div className="mb-4">
        <label className="text-xs font-medium text-muted mb-1.5 block">
          Select your bank
        </label>
        <div className="relative">
          <select
            value={selectedBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            className="w-full appearance-none bg-slate-50 border border-border rounded-xl px-3 py-2.5
              text-sm text-content focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
              transition-colors"
          >
            <option value="">— Choose a bank —</option>
            {banksData.map((bank) => (
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

      {/* Card list */}
      {selectedBankId && (
        <div>
          <label className="text-xs font-medium text-muted mb-2 block">
            Select card
          </label>
          {availableCards.length === 0 ? (
            <p className="text-xs text-muted py-2">
              All cards from this bank are already added.
            </p>
          ) : (
            <div className="space-y-2">
              {availableCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => onAdd(card)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl
                    bg-slate-50 hover:bg-primary/5 border border-transparent hover:border-primary/20
                    transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content truncate">
                      {card.name}
                    </p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge
                        variant={card.type === 'credit' ? 'credit' : 'debit'}
                        size="sm"
                      >
                        {formatCardTypeName(card.type)}
                      </Badge>
                      <Badge
                        variant={
                          card.network as 'visa' | 'mastercard' | 'amex'
                        }
                        size="sm"
                      >
                        {formatNetworkName(card.network)}
                      </Badge>
                    </div>
                  </div>
                  <PlusCircle
                    size={18}
                    className="text-muted group-hover:text-primary transition-colors shrink-0"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedBankId && (
        <p className="text-xs text-muted text-center py-4">
          Choose a bank to see available cards
        </p>
      )}
    </div>
  )
}
