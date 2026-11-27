import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FilterState, Offer, OfferType, SelectedCard, SortOrder } from '@/types'
import { getOfferBanks, isOfferMatchingCardFilters } from '@/utils/offerMatching'
import { getOfferTypes, getBenefitValue, OFFER_TYPES } from '@/utils/offerDisplay'
import { getDaysRemaining } from '@/utils/dateUtils'
import { normalizeForSearch } from '@/utils/normalization'

const filterParams: Record<keyof FilterState, string> = {
  search: 'q',
  bankSlug: 'bank',
  categorySlug: 'category',
  offerType: 'type',
  cardType: 'card',
  network: 'network',
  myCardsOnly: 'myCardsOnly',
  endingSoon: 'ending',
  sort: 'sort',
}

export const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'ending', label: 'Ending soonest' },
  { id: 'value', label: 'Biggest saving' },
  { id: 'newest', label: 'Newest' },
]

const ENDING_SOON_DAYS = 7

export function isEndingSoon(offer: Offer): boolean {
  const days = getDaysRemaining(offer.valid_to)
  return days !== null && days >= 0 && days <= ENDING_SOON_DAYS
}

interface Options {
  /** Filters fixed by the page (e.g. a bank page) — ignored in URL params and counts. */
  locked?: Partial<Pick<FilterState, 'bankSlug' | 'categorySlug'>>
}

export function useOfferFilters(offers: Offer[], selectedCards: SelectedCard[], { locked = {} }: Options = {}) {
  const [params, setParams] = useSearchParams()
  const filters = useMemo<FilterState>(() => {
    const card = params.get('card')
    const network = params.get('network')
    return {
      search: params.get('q') ?? '',
      bankSlug: locked.bankSlug ?? params.get('bank'),
      categorySlug: locked.categorySlug ?? params.get('category'),
      offerType: OFFER_TYPES.find(({ id }) => id === params.get('type'))?.id ?? null,
      cardType: card === 'credit' || card === 'debit' ? card : null,
      network: network === 'visa' || network === 'mastercard' || network === 'amex' || network === 'other' ? network : null,
      myCardsOnly: params.get('myCardsOnly') === 'true',
      endingSoon: params.get('ending') === 'true',
      sort: SORT_OPTIONS.find(({ id }) => id === params.get('sort'))?.id ?? 'recommended',
    }
  }, [params, locked.bankSlug, locked.categorySlug])

  function setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    const next = new URLSearchParams(params)
    const param = filterParams[key]
    if (value && !(key === 'sort' && value === 'recommended')) next.set(param, String(value))
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

  // Everything except category and offer type, so those chips can show how
  // many results each choice would give.
  const baseMatches = useMemo(() => {
    const query = normalizeForSearch(filters.search)
    return indexedOffers.filter(({ offer, searchText }) =>
      (!query || searchText.includes(query)) &&
      (!filters.endingSoon || isEndingSoon(offer)) &&
      isOfferMatchingCardFilters(offer, filters, selectedCards),
    )
  }, [indexedOffers, filters, selectedCards])

  const { categoryCounts, typeCounts, filtered, totalBeforeCategory } = useMemo(() => {
    const categoryCounts: Record<string, number> = {}
    const typeCounts: Partial<Record<OfferType, number>> = {}
    const filtered: Offer[] = []
    let totalBeforeCategory = 0
    for (const { offer, types } of baseMatches) {
      const inCategory = !filters.categorySlug || offer.category?.slug === filters.categorySlug
      const inType = !filters.offerType || types.includes(filters.offerType)
      if (inType) {
        totalBeforeCategory++
        const slug = offer.category?.slug
        if (slug) categoryCounts[slug] = (categoryCounts[slug] ?? 0) + 1
      }
      if (inCategory) for (const type of types) typeCounts[type] = (typeCounts[type] ?? 0) + 1
      if (inCategory && inType) filtered.push(offer)
    }
    return { categoryCounts, typeCounts, filtered, totalBeforeCategory }
  }, [baseMatches, filters.categorySlug, filters.offerType])

  const filteredOffers = useMemo(() => sortOffers(filtered, filters.sort), [filtered, filters.sort])
  const totalBeforeType = useMemo(
    () => baseMatches.filter(({ offer }) => !filters.categorySlug || offer.category?.slug === filters.categorySlug).length,
    [baseMatches, filters.categorySlug],
  )
  // How many of the current results (ignoring the toggle itself) end this week.
  const endingSoonCount = useMemo(() => {
    const query = normalizeForSearch(filters.search)
    return indexedOffers.filter(({ offer, types, searchText }) =>
      isEndingSoon(offer) &&
      (!query || searchText.includes(query)) &&
      (!filters.categorySlug || offer.category?.slug === filters.categorySlug) &&
      (!filters.offerType || types.includes(filters.offerType)) &&
      isOfferMatchingCardFilters(offer, filters, selectedCards),
    ).length
  }, [indexedOffers, filters, selectedCards])

  const activeFilterCount = (Object.keys(filters) as (keyof FilterState)[]).filter((key) =>
    key !== 'sort' && !(key in locked) && Boolean(filters[key]),
  ).length

  return {
    filters, setFilter, resetFilters, filteredOffers, activeFilterCount,
    categoryCounts, totalBeforeCategory, typeCounts, totalBeforeType, endingSoonCount,
  }
}

export function sortOffers(offers: Offer[], sort: SortOrder): Offer[] {
  if (sort === 'recommended') return offers
  const sorted = [...offers]
  if (sort === 'ending') {
    const end = (offer: Offer) => (offer.valid_to ? Date.parse(offer.valid_to) : Number.POSITIVE_INFINITY)
    sorted.sort((a, b) => end(a) - end(b))
  } else if (sort === 'value') {
    sorted.sort((a, b) => getBenefitValue(b) - getBenefitValue(a))
  } else if (sort === 'newest') {
    const published = (offer: Offer) => (offer.published_at ? Date.parse(offer.published_at) : 0)
    sorted.sort((a, b) => published(b) - published(a))
  }
  return sorted
}
