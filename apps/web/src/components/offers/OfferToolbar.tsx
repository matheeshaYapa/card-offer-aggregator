import { BadgePercent, CalendarClock, Coins, Gift, Hourglass, LayoutGrid, type LucideIcon } from 'lucide-react'
import type { FilterState, OfferType, SortOrder } from '@/types'
import { OFFER_TYPES } from '@/utils/offerDisplay'
import { SORT_OPTIONS } from '@/hooks/useOfferFilters'

export const OFFER_TYPE_ICONS: Record<OfferType, LucideIcon> = {
  discount: BadgePercent,
  cashback: Coins,
  installment: CalendarClock,
  bonus: Gift,
}

interface OfferToolbarProps {
  filters: FilterState
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  typeCounts: Partial<Record<OfferType, number>>
  totalBeforeType: number
  resultCount: number
  endingSoonCount: number
  loading?: boolean
}

/** Offer-type chips (with counts), "ending this week" and sort order. */
export default function OfferToolbar({
  filters, onChange, typeCounts, totalBeforeType, resultCount, endingSoonCount, loading = false,
}: OfferToolbarProps) {
  const chip = (active: boolean) =>
    `offer-type-chip ${active ? 'offer-type-chip-active' : ''}`

  return (
    <div className="offer-toolbar">
      <div className="offer-type-row scrollbar-hide" role="group" aria-label="Offer type">
        <button type="button" className={chip(!filters.offerType)} aria-pressed={!filters.offerType} onClick={() => onChange('offerType', null)}>
          <LayoutGrid size={16} aria-hidden="true" />
          All offers
          {!loading && <span className="chip-count">{totalBeforeType}</span>}
        </button>
        {OFFER_TYPES.map(({ id, label }) => {
          const Icon = OFFER_TYPE_ICONS[id]
          const count = typeCounts[id] ?? 0
          const active = filters.offerType === id
          if (!loading && count === 0 && !active) return null
          return (
            <button
              key={id}
              type="button"
              className={chip(active)}
              aria-pressed={active}
              onClick={() => onChange('offerType', active ? null : id)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
              {!loading && <span className="chip-count">{count}</span>}
            </button>
          )
        })}
        {(endingSoonCount > 0 || filters.endingSoon) && (
          <button
            type="button"
            className={`${chip(filters.endingSoon)} offer-type-chip-urgent`}
            aria-pressed={filters.endingSoon}
            onClick={() => onChange('endingSoon', !filters.endingSoon)}
          >
            <Hourglass size={16} aria-hidden="true" />
            Ending this week
            {!loading && <span className="chip-count">{endingSoonCount}</span>}
          </button>
        )}
      </div>

      <div className="offer-toolbar-meta">
        <p role="status" className="offer-result-count">
          {loading ? 'Loading offers…' : <><strong>{resultCount.toLocaleString('en-LK')}</strong> {resultCount === 1 ? 'offer' : 'offers'}</>}
        </p>
        <label className="offer-sort">
          <span>Sort</span>
          <select value={filters.sort} onChange={(event) => onChange('sort', event.target.value as SortOrder)}>
            {SORT_OPTIONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}
