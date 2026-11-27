import { useId, useState } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { Bank, FilterState } from '@/types'
import { OFFER_TYPES } from '@/utils/offerDisplay'

interface OfferFiltersProps {
  filters: FilterState
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  onReset: () => void
  activeFilterCount: number
  banks: Bank[]
}

export default function OfferFilters({
  filters, onChange, onReset, activeFilterCount, banks,
}: OfferFiltersProps) {
  const [expanded, setExpanded] = useState(false)
  const fieldsId = useId()
  const filterCount = activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>
  return (
    <section className="browse-filters" aria-label="Filters">
      <h3 className="browse-filter-heading">
        <SlidersHorizontal size={17} aria-hidden="true" />
        Filters
        {filterCount}
      </h3>
      <button type="button" className="browse-filter-heading" aria-expanded={expanded} aria-controls={fieldsId} onClick={() => setExpanded(!expanded)}>
        <SlidersHorizontal size={17} aria-hidden="true" />
        Filters
        {filterCount}
        <ChevronDown size={18} className={`filter-chevron ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div className={`browse-filter-fields ${expanded ? '' : 'browse-filter-fields-collapsed'}`} id={fieldsId}>
        <label>
          Bank
          <select value={filters.bankSlug ?? ''} onChange={(event) => onChange('bankSlug', event.target.value || null)}>
            <option value="">All banks</option>
            {banks.map((bank) => <option key={bank.id} value={bank.slug}>{bank.name}</option>)}
          </select>
        </label>
        <label>
          Offer type
          <select value={filters.offerType ?? ''} onChange={(event) => onChange('offerType', OFFER_TYPES.find(({ id }) => id === event.target.value)?.id ?? null)}>
            <option value="">All offer types</option>
            {OFFER_TYPES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label>
          Card type
          <select value={filters.cardType ?? ''} onChange={(event) => onChange('cardType', event.target.value as FilterState['cardType'] || null)}>
            <option value="">Credit and debit</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
        </label>
        <label>
          Card network
          <select value={filters.network ?? ''} onChange={(event) => onChange('network', event.target.value as FilterState['network'] || null)}>
            <option value="">All networks</option>
            <option value="visa">Visa</option>
            <option value="mastercard">Mastercard</option>
            <option value="amex">American Express</option>
            <option value="other">Other</option>
          </select>
        </label>
        {activeFilterCount > 0 && (
          <button type="button" className="browse-reset" onClick={onReset}>Clear all filters</button>
        )}
      </div>
    </section>
  )
}
