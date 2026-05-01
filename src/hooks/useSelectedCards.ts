import { useLocalStorage } from './useLocalStorage'
import type { Card } from '@/types'

const STORAGE_KEY = 'cardpromo.selectedCards'

export function useSelectedCards() {
  const [selectedCards, setSelectedCards] = useLocalStorage<Card[]>(
    STORAGE_KEY,
    [],
  )

  function addCard(card: Card) {
    setSelectedCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev
      return [...prev, card]
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
