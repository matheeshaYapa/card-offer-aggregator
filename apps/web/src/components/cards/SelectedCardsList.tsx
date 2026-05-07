import { X, CreditCard } from 'lucide-react'
import type { SelectedCard } from '@/types'
import Badge from '@/components/common/Badge'
import EmptyState from '@/components/common/EmptyState'
import { formatNetworkName, formatCardTypeName } from '@/utils/normalization'
import { Link } from 'react-router-dom'

interface SelectedCardsListProps {
  cards: SelectedCard[]
  onRemove: (cardId: string) => void
}

export default function SelectedCardsList({ cards, onRemove }: SelectedCardsListProps) {
  if (cards.length === 0) {
    return (
      <EmptyState
        icon={<CreditCard size={24} />}
        title="No cards added yet"
        description="Add your bank cards above to see promotions tailored to you."
        action={
          <Link to="/" className="text-xs text-primary underline underline-offset-2">
            Browse all promotions
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-2">
      {cards.map((card) => (
        <div key={card.id} className="flex items-center gap-3 bg-white border border-border rounded-xl p-3.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <CreditCard size={17} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-content truncate">
              {card.bank_short_name} – {card.name}
            </p>
            <div className="flex gap-1.5 mt-1">
              <Badge variant={card.card_type === 'credit' ? 'credit' : 'debit'} size="sm">
                {formatCardTypeName(card.card_type)}
              </Badge>
              <Badge
                variant={card.network as 'visa' | 'mastercard' | 'amex' | 'other'}
                size="sm"
              >
                {formatNetworkName(card.network)}
              </Badge>
            </div>
          </div>
          <button
            onClick={() => onRemove(card.id)}
            className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-muted hover:text-danger transition-colors shrink-0"
            aria-label={`Remove ${card.name}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
