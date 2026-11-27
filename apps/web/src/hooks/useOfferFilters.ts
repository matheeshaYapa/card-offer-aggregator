import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FilterState, Offer, SelectedCard } from '@/types'
import { getOfferBanks, isOfferMatchingCardFilters } from '@/utils/offerMatching'
import { getOfferTypes, OFFER_TYPES } from '@/utils/offerDisplay'
import { normalizeForSearch } from '@/utils/normalization'

const filterParams: Record<keyof FilterState, string> = {
  search: 'q',
  bankSlug: 'bank',
  categorySlug: 'category',
  offerType: 'type',
  cardType: 'card',
  network: 'network',
  myCardsOnly: 'myCardsOnly',
}

export function useOfferFilters(offers: Offer[], selectedCards: SelectedCard[]) {
  const [params, setParams] = useSearchParams()
  const filters = useMemo<FilterState>(() => {
    const card = params.get('card')
    const network = params.get('network')
    return {
      search: params.get('q') ?? '',
      bankSlug: params.get('bank'),
      categorySlug: params.get('category'),
      offerType: OFFER_TYPES.find(({ id }) => id === params.get('type'))?.id ?? null,
      cardType: card === 'credit' || card === 'debit' ? card : null,
      network: network === 'visa' || network === 'mastercard' || network === 'amex' || network === 'other' ? network : null,
      myCardsOnly: params.get('myCardsOnly') === 'true',
    }
  }, [params])

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    const next = new URLSearchParams(params)
    const param = filterParams[key]
    if (value) next.set(param, String(value))
    else next.delete(param)
    setParams(next, { replace: key === 'search', preventScrollReset: true })
  }

  function resetFilters() {
    const next = new URLSearchParams(params)
    for (const key of Object.values(filterParams)) next.delete(key)
    setParams(next, { preventScrollReset: true })
  }

  const indexedOffers = useMemo(() => offers.map((offer) => ({
    offer,
    types: getOfferTypes(offer),
    searchText: normalizeForSearch([
      offer.title,
      offer.merchant?.name ?? '',
      offer.description ?? '',
      offer.discount_text ?? '',
      offer.category?.name ?? '',
      ...getOfferBanks(offer).map((bank) => [bank.name, bank.short_name].join(' ')),
      ...(offer.offer_cards ?? []).map(({ card }) => card?.name ?? ''),
    ].join(' ')),
  })), [offers])

  // Offers matching every filter except category, so category chips can show
  // how many results each one would give.
  const offersBeforeCategory = useMemo(() => {
    const query = normalizeForSearch(filters.search)
    return indexedOffers.filter(({ offer, types, searchText }) =>
      (!filters.offerType || types.includes(filters.offerType)) &&
      (!query || searchText.includes(query)) &&
      isOfferMatchingCardFilters(offer, filters, selectedCards),
    ).map(({ offer }) => offer)
  }, [indexedOffers, filters, selectedCards])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const offer of offersBeforeCategory) {
      const slug = offer.category?.slug
      if (slug) counts[slug] = (counts[slug] ?? 0) + 1
    }
    return counts
  }, [offersBeforeCategory])

  const filteredOffers = useMemo(() => (
    filters.categorySlug
      ? offersBeforeCategory.filter((offer) => offer.category?.slug === filters.categorySlug)
      : offersBeforeCategory
  ), [offersBeforeCategory, filters.categorySlug])

  const activeFilterCount = Object.values(filters).filter(Boolean).length
  return {
    filters, setFilter, resetFilters, filteredOffers, activeFilterCount,
    categoryCounts, totalBeforeCategory: offersBeforeCategory.length,
  }
}
