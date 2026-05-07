import { useLocalStorage } from './useLocalStorage'
import type { Card, SelectedCard } from '@/types'

const STORAGE_KEY = 'cardpromo.selectedCards'

function toSelectedCard(card: Card): SelectedCard {
  return {
    id: card.id,
    bank_id: card.bank_id,
    bank_name: card.bank?.name ?? '',
    bank_short_name: card.bank?.short_name ?? card.bank?.name ?? '',
    name: card.name,
    card_type: card.card_type,
    network: card.network,
    slug: card.slug,
  }
}

export function useSelectedCards() {
  const [selectedCards, setSelectedCards] = useLocalStorage<SelectedCard[]>(
    STORAGE_KEY,
    [],
  )

  function addCard(card: Card) {
    setSelectedCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev
      return [...prev, toSelectedCard(card)]
    })
  }

  function removeCard(cardId: string) {
    setSelectedCards((prev) => prev.filter((c) => c.id !== cardId))
  }

  function hasCard(cardId: string) {
    return selectedCards.some((c) => c.id === cardId)
  }

  function clearCards() {
    setSelectedCards([])
  }

  return { selectedCards, addCard, removeCard, hasCard, clearCards }
}
