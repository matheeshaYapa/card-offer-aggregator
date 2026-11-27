import type { Category } from '@/types'
import { getCategoryMeta } from '@/utils/categoryMeta'

interface CategoryChipsProps {
  categories: Category[]
  counts: Record<string, number>
  total: number
  selected: string | null
  onSelect: (slug: string | null) => void
  loading?: boolean
}

/** Category filter chips with icons and counts; empty categories are hidden. */
export default function CategoryChips({ categories, counts, total, selected, onSelect, loading = false }: CategoryChipsProps) {
  const visible = categories
    .filter((category) => (counts[category.slug] ?? 0) > 0 || selected === category.slug)
    .sort((a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0))
  if (!loading && visible.length === 0) return null

  return (
    <div className="browse-categories scrollbar-hide" role="group" aria-label="Offer category">
      <button type="button" aria-pressed={!selected} onClick={() => onSelect(null)}>
        All categories{!loading && <span className="browse-category-count">{total}</span>}
      </button>
      {visible.map((category) => {
        const { icon: Icon } = getCategoryMeta(category.slug)
        const active = selected === category.slug
        return (
          <button key={category.id} type="button" aria-pressed={active} onClick={() => onSelect(active ? null : category.slug)}>
            <Icon size={15} aria-hidden="true" className="browse-category-icon" />
            {category.name}
            {!loading && <span className="browse-category-count">{counts[category.slug] ?? 0}</span>}
          </button>
        )
      })}
    </div>
  )
}
