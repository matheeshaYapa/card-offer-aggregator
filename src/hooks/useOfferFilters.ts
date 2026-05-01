import { useState, useMemo } from 'react'
import type { Card, FilterState, Offer } from '@/types'
import { isOfferExpired } from '@/utils/dateUtils'
import { isOfferMatchingSelectedCards } from '@/utils/offerMatching'
import { normalizeForSearch } from '@/utils/normalization'
import banksData from '@/data/banks.json'
import categoriesData from '@/data/categories.json'

const DEFAULT_FILTERS: FilterState = {
  search: '',
  bankId: null,
  categoryId: null,
  cardType: null,
  network: null,
  myCardsOnly: false,
  showExpired: false,
}

export function useOfferFilters(offers: Offer[], selectedCards: Card[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const setFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const resetFilters = () => setFilters(DEFAULT_FILTERS)

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (!offer.isActive) return false
      if (!filters.showExpired && isOfferExpired(offer)) return false

      if (filters.bankId && !offer.bankIds.includes(filters.bankId))
        return false

      if (filters.categoryId && offer.categoryId !== filters.categoryId)
        return false

      if (
        filters.cardType &&
        offer.eligibleCardTypes?.length &&
        !offer.eligibleCardTypes.includes(filters.cardType)
      )
        return false

      if (
        filters.network &&
        offer.eligibleNetworks?.length &&
        !offer.eligibleNetworks.includes(filters.network)
      )
        return false

      if (filters.myCardsOnly && selectedCards.length > 0) {
        if (!isOfferMatchingSelectedCards(offer, selectedCards)) return false
      }

      if (filters.search) {
        const q = normalizeForSearch(filters.search)
        const bank = banksData.find((b) => offer.bankIds.includes(b.id))
        const category = categoriesData.find(
          (c) => c.id === offer.categoryId,
        )
        const haystack = [
          offer.title,
          offer.merchantName,
          offer.description,
          category?.name ?? '',
          bank?.name ?? '',
          bank?.shortName ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [offers, filters, selectedCards])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.search) count++
    if (filters.bankId) count++
    if (filters.categoryId) count++
    if (filters.cardType) count++
    if (filters.network) count++
    if (filters.myCardsOnly) count++
    return count
  }, [filters])

  return { filters, setFilter, resetFilters, filteredOffers, activeFilterCount }
}
