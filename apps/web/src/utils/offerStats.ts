import type { Bank, Category, Offer } from '@/types'
import { getOfferBanks } from './offerMatching'
import { getOfferTypes } from './offerDisplay'
import { getDaysRemaining } from './dateUtils'

export interface Ranked<T> {
  item: T
  count: number
}

export interface OfferStats {
  total: number
  bankCount: number
  topBanks: Ranked<Bank>[]
  topCategories: Ranked<Category>[]
  installmentCount: number
  cashbackCount: number
  endingThisWeek: number
  creditOnly: number
  debitEligible: number
}

/** Live numbers for hero stats, landing-page copy and FAQ answers. */
export function getOfferStats(offers: Offer[]): OfferStats {
  const banks = new Map<string, Ranked<Bank>>()
  const categories = new Map<string, Ranked<Category>>()
  let installmentCount = 0
  let cashbackCount = 0
  let endingThisWeek = 0
  let creditOnly = 0
  let debitEligible = 0

  for (const offer of offers) {
    for (const bank of getOfferBanks(offer)) {
      const entry = banks.get(bank.slug) ?? { item: bank, count: 0 }
      entry.count++
      banks.set(bank.slug, entry)
    }
    if (offer.category) {
      const entry = categories.get(offer.category.slug) ?? { item: offer.category, count: 0 }
      entry.count++
      categories.set(offer.category.slug, entry)
    }
    const types = getOfferTypes(offer)
    if (types.includes('installment')) installmentCount++
    if (types.includes('cashback')) cashbackCount++
    const days = getDaysRemaining(offer.valid_to)
    if (days !== null && days >= 0 && days <= 7) endingThisWeek++
    const cardTypes = new Set((offer.offer_bank_rules ?? []).map((rule) => rule.card_type ?? 'any'))
    if (cardTypes.size === 1 && cardTypes.has('credit')) creditOnly++
    if (cardTypes.has('debit') || cardTypes.has('any')) debitEligible++
  }

  const rank = <T,>(map: Map<string, Ranked<T>>) => [...map.values()].sort((a, b) => b.count - a.count)
  return {
    total: offers.length,
    bankCount: banks.size,
    topBanks: rank(banks),
    topCategories: rank(categories),
    installmentCount,
    cashbackCount,
    endingThisWeek,
    creditOnly,
    debitEligible,
  }
}

/** "A, B and C" */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function bankLabel(bank: Bank): string {
  return bank.short_name ?? bank.name
}
