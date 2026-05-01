import { useState } from 'react'
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import type { FilterState } from '@/types'
import SearchInput from '@/components/common/SearchInput'
import banksData from '@/data/banks.json'
import categoriesData from '@/data/categories.json'

interface OfferFiltersProps {
  filters: FilterState
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  onReset: () => void
  activeFilterCount: number
  selectedCardCount: number
}

const NETWORKS = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'amex', label: 'Amex' },
] as const

const CARD_TYPES = [
  { id: 'credit', label: 'Credit' },
  { id: 'debit', label: 'Debit' },
] as const

export default function OfferFilters({
  filters,
  onChange,
  onReset,
  activeFilterCount,
  selectedCardCount,
}: OfferFiltersProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mb-6 space-y-3">
      {/* Search */}
      <SearchInput
        value={filters.search}
        onChange={(v) => onChange('search', v)}
      />

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => onChange('categoryId', null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !filters.categoryId
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-muted border-border hover:border-primary/40'
          }`}
        >
          All
        </button>
        {categoriesData.map((cat) => (
          <button
            key={cat.id}
            onClick={() =>
              onChange('categoryId', filters.categoryId === cat.id ? null : cat.id)
            }
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filters.categoryId === cat.id
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-muted border-border hover:border-primary/40'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Advanced filters toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors"
        >
          <SlidersHorizontal size={14} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            size={14}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* My cards toggle */}
        {selectedCardCount > 0 && (
          <button
            onClick={() => onChange('myCardsOnly', !filters.myCardsOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filters.myCardsOnly
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-muted border-border hover:border-primary/40'
            }`}
          >
            {filters.myCardsOnly ? '✓ ' : ''}My cards only
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {expanded && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-4">
          {/* Bank filter */}
          <div>
            <label className="text-xs font-semibold text-content mb-2 block">
              Bank
            </label>
            <div className="flex flex-wrap gap-2">
              {banksData.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() =>
                    onChange(
                      'bankId',
                      filters.bankId === bank.id ? null : bank.id,
                    )
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    filters.bankId === bank.id
                      ? 'bg-primary text-white border-primary'
                      : 'bg-slate-50 text-muted border-border hover:border-primary/40'
                  }`}
                >
                  {bank.shortName}
                </button>
              ))}
            </div>
          </div>

          {/* Card type */}
          <div>
            <label className="text-xs font-semibold text-content mb-2 block">
              Card Type
            </label>
            <div className="flex gap-2">
              {CARD_TYPES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() =>
                    onChange(
                      'cardType',
                      filters.cardType === id ? null : id,
                    )
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    filters.cardType === id
                      ? 'bg-primary text-white border-primary'
                      : 'bg-slate-50 text-muted border-border hover:border-primary/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Network */}
          <div>
            <label className="text-xs font-semibold text-content mb-2 block">
              Card Network
            </label>
            <div className="flex gap-2">
              {NETWORKS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() =>
                    onChange('network', filters.network === id ? null : id)
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    filters.network === id
                      ? 'bg-primary text-white border-primary'
                      : 'bg-slate-50 text-muted border-border hover:border-primary/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          {activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-danger hover:underline"
            >
              <X size={12} />
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
