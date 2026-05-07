import type { Offer, SelectedCard } from '@/types'

/**
 * Returns true if the offer is eligible for at least one of the user's
 * selected cards, using both explicit card links (offer_cards) and
 * broad bank/type/network rules (offer_bank_rules).
 *
 * If no cards are selected, all offers pass.
 *
 * Future backend: push this filtering to a Supabase RPC function for
 * large datasets.
 */
export function isOfferMatchingSelectedCards(
  offer: Offer,
  selectedCards: SelectedCard[],
): boolean {
  if (!selectedCards.length) return true

  return selectedCards.some((card) => {
    // 1. Check explicit per-card eligibility
    const explicitMatch =
      offer.offer_cards?.some((oc) => oc.card_id === card.id) ?? false

    if (explicitMatch) return true

    // 2. Check broad bank / type / network rules
    const ruleMatch =
      offer.offer_bank_rules?.some((rule) => {
        const bankOk = rule.bank_id === card.bank_id
        const typeOk = !rule.card_type || rule.card_type === card.card_type
        const networkOk = !rule.network || rule.network === card.network
        return bankOk && typeOk && networkOk
      }) ?? false

    return ruleMatch
  })
}

export function isOfferMatchingBankSlug(offer: Offer, bankSlug: string): boolean {
  const ruleMatch =
    offer.offer_bank_rules?.some((rule) => rule.bank?.slug === bankSlug) ?? false

  if (ruleMatch) return true

  return (
    offer.offer_cards?.some((offerCard) => offerCard.card?.bank?.slug === bankSlug) ??
    false
  )
}

export function isOfferMatchingCardType(
  offer: Offer,
  cardType: SelectedCard['card_type'],
): boolean {
  const ruleMatch =
    offer.offer_bank_rules?.some(
      (rule) => !rule.card_type || rule.card_type === cardType,
    ) ?? false

  const explicitMatch =
    offer.offer_cards?.some((offerCard) => offerCard.card?.card_type === cardType) ??
    false

  return ruleMatch || explicitMatch
}

export function isOfferMatchingNetwork(
  offer: Offer,
  network: SelectedCard['network'],
): boolean {
  const ruleMatch =
    offer.offer_bank_rules?.some((rule) => !rule.network || rule.network === network) ??
    false

  const explicitMatch =
    offer.offer_cards?.some((offerCard) => offerCard.card?.network === network) ?? false

  return ruleMatch || explicitMatch
}
