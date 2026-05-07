import { useCallback, useMemo, useState } from 'react'
import type { FilterState, Offer, SelectedCard } from '@/types'
import {
  isOfferMatchingBankSlug,
  isOfferMatchingCardType,
  isOfferMatchingNetwork,
  isOfferMatchingSelectedCards,
} from '@/utils/offerMatching'
import { normalizeForSearch } from '@/utils/normalization'

const DEFAULT_FILTERS: FilterState = {
  search: '',
  bankSlug: null,
  categorySlug: null,
  merchantSlug: null,
  cardType: null,
  network: null,
  myCardsOnly: false,
  showExpired: false,
}

export function useOfferFilters(offers: Offer[], selectedCards: SelectedCard[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const setFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (filters.bankSlug) {
        if (!isOfferMatchingBankSlug(offer, filters.bankSlug)) return false
      }

      if (filters.categorySlug && offer.category?.slug !== filters.categorySlug)
        return false

      if (filters.merchantSlug && offer.merchant?.slug !== filters.merchantSlug)
        return false

      if (filters.cardType) {
        if (!isOfferMatchingCardType(offer, filters.cardType)) return false
      }

      if (filters.network) {
        if (!isOfferMatchingNetwork(offer, filters.network)) return false
      }

      if (filters.myCardsOnly && selectedCards.length > 0) {
        if (!isOfferMatchingSelectedCards(offer, selectedCards)) return false
      }

      if (filters.search) {
        const q = normalizeForSearch(filters.search)
        const bankNames = [
          ...(offer.offer_bank_rules ?? []).map(
            (r) => `${r.bank?.name ?? ''} ${r.bank?.short_name ?? ''}`,
          ),
          ...(offer.offer_cards ?? []).map(
            (oc) =>
              `${oc.card?.bank?.name ?? ''} ${oc.card?.bank?.short_name ?? ''} ${oc.card?.name ?? ''}`,
          ),
        ]
          .filter(Boolean)
          .join(' ')
        const haystack = normalizeForSearch([
          offer.title,
          offer.merchant?.name ?? '',
          offer.description ?? '',
          offer.category?.name ?? '',
          bankNames,
        ].join(' '))
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [offers, filters, selectedCards])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.search) count++
    if (filters.bankSlug) count++
    if (filters.categorySlug) count++
    if (filters.merchantSlug) count++
    if (filters.cardType) count++
    if (filters.network) count++
    if (filters.myCardsOnly) count++
    return count
  }, [filters])

  return { filters, setFilter, resetFilters, filteredOffers, activeFilterCount }
}
