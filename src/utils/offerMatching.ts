import type { Card, Offer } from '@/types'

export function isOfferMatchingSelectedCards(
  offer: Offer,
  selectedCards: Card[],
): boolean {
  if (!selectedCards.length) return true

  return selectedCards.some((card) => {
    const matchesCardId =
      !offer.eligibleCardIds?.length ||
      offer.eligibleCardIds.includes(card.id)

    const matchesBank =
      !offer.bankIds?.length || offer.bankIds.includes(card.bankId)

    const matchesType =
      !offer.eligibleCardTypes?.length ||
      offer.eligibleCardTypes.includes(card.type)

    const matchesNetwork =
      !offer.eligibleNetworks?.length ||
      offer.eligibleNetworks.includes(card.network)

    return matchesCardId && matchesBank && matchesType && matchesNetwork
  })
}
