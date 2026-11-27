import type { Bank, FilterState, Offer, SelectedCard } from '@/types'

export function getOfferBanks(offer: Offer): Bank[] {
  const banks = new Map<string, Bank>()
  for (const { bank } of offer.offer_bank_rules ?? []) {
    if (bank) banks.set(bank.id, bank)
  }
  for (const { card } of offer.offer_cards ?? []) {
    if (card?.bank) banks.set(card.bank.id, card.bank)
  }
  return [...banks.values()]
}

type CardFilters = Pick<FilterState, 'bankSlug' | 'cardType' | 'network' | 'myCardsOnly'>

export function isOfferMatchingCardFilters(
  offer: Offer,
  filters: CardFilters,
  selectedCards: SelectedCard[],
): boolean {
  const { bankSlug, cardType, network, myCardsOnly } = filters
  if (!bankSlug && !cardType && !network && !myCardsOnly) return true

  const cards = myCardsOnly ? selectedCards.filter((card) =>
    (!cardType || card.card_type === cardType) && (!network || card.network === network),
  ) : []

  const explicitMatch = offer.offer_cards?.some(({ card_id, card }) =>
    (!bankSlug || card?.bank?.slug === bankSlug) &&
    (!cardType || card?.card_type === cardType) &&
    (!network || card?.network === network) &&
    (!myCardsOnly || cards.some(({ id }) => id === card_id)),
  )

  // Bank-only rules identify the issuer. For scraped offers, missing eligibility
  // fields provide no evidence that a selected card, type or network qualifies.
  const broadRuleMatch = offer.offer_bank_rules?.some((rule) => {
    if (bankSlug && rule.bank?.slug !== bankSlug) return false
    const scraped = offer.source_type === 'scraped'
    if (cardType && (rule.card_type ? rule.card_type !== cardType : scraped)) return false
    if (network && (rule.network ? rule.network !== network : scraped)) return false
    if (!myCardsOnly) return true
    return cards.some((card) =>
      rule.bank_id === card.bank_id &&
      (rule.card_type ? rule.card_type === card.card_type : !scraped || !!rule.network) &&
      (!rule.network || rule.network === card.network),
    )
  })
  return !!(explicitMatch || broadRuleMatch)
}

export function isOfferMatchingBankSlug(offer: Offer, bankSlug: string): boolean {
  return getOfferBanks(offer).some((bank) => bank.slug === bankSlug)
}
