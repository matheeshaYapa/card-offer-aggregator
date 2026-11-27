import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Category, Offer } from '@/types'
import { getCategoryMeta } from '@/utils/categoryMeta'

interface CategoryTilesProps {
  categories: Category[]
  offers: Offer[]
}

/**
 * "Browse by category" tiles. Real links (not buttons) so crawlers follow
 * them to the category landing pages; only categories with offers are shown.
 */
export default function CategoryTiles({ categories, offers }: CategoryTilesProps) {
  const counts: Record<string, number> = {}
  for (const offer of offers) {
    const slug = offer.category?.slug
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1
  }
  const tiles = categories
    .filter((category) => counts[category.slug])
    .sort((a, b) => counts[b.slug] - counts[a.slug])
  if (tiles.length === 0) return null

  return (
    <section className="category-tiles-section" aria-labelledby="category-tiles-heading">
      <div className="section-heading">
        <h2 id="category-tiles-heading">Browse card offers by category</h2>
      </div>
      <ul className="category-tiles">
        {tiles.map((category) => {
          const { icon: Icon, tile, iconColor } = getCategoryMeta(category.slug)
          return (
            <li key={category.id}>
              <Link to={`/category/${category.slug}`} className={`category-tile ${tile}`}>
                <span className={`category-tile-icon ${iconColor}`}><Icon size={22} aria-hidden="true" /></span>
                <span className="category-tile-name">{category.name}</span>
                <span className="category-tile-count">{counts[category.slug]} offers</span>
                <ArrowRight size={16} aria-hidden="true" className="category-tile-arrow" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
