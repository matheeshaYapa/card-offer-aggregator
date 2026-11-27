import { Link } from 'react-router-dom'
import { Wallet, X } from 'lucide-react'
import type { Bank, SelectedCard } from '@/types'
import { formatCardTypeName, formatNetworkName } from '@/utils/normalization'
import { getBankTheme } from '@/utils/bankTheme'

interface InlineCardManagerProps {
  selectedCards: SelectedCard[]
  banks: Bank[]
  onRemove: (cardId: string) => void
  myCardsOnly: boolean
  onToggleMyCards: (next: boolean) => void
}

export default function InlineCardManager({
  selectedCards, banks, onRemove, myCardsOnly, onToggleMyCards,
}: InlineCardManagerProps) {
  const hasCards = selectedCards.length > 0

  return (
    <section className="browse-wallet" aria-labelledby="wallet-heading">
      <div className="browse-wallet-heading">
        <span><Wallet size={20} aria-hidden="true" /></span>
        <h3 id="wallet-heading">My cards</h3>
      </div>
      {hasCards ? (
        <>
          <label className="browse-wallet-toggle">
            <input type="checkbox" checked={myCardsOnly} onChange={(event) => onToggleMyCards(event.target.checked)} />
            Match my cards only
          </label>
          <ul className="browse-wallet-cards">
            {selectedCards.map((card) => {
              const theme = getBankTheme(banks.find(({ id }) => id === card.bank_id)?.slug)
              return (
                <li key={card.id}>
                  <span className={theme.stripe} aria-hidden="true" />
                  <div>
                    <strong>{card.bank_short_name}</strong>
                    <small>{formatNetworkName(card.network)} {formatCardTypeName(card.card_type)}</small>
                  </div>
                  <button type="button" aria-label={`Remove ${card.bank_short_name} ${card.name}`} onClick={() => onRemove(card.id)}>
                    <X size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : <p>Save your cards to find offers you can use.</p>}
      <Link className="browse-action" to="/my-cards">{hasCards ? 'Manage cards' : 'Add your cards'}</Link>
    </section>
  )
}
