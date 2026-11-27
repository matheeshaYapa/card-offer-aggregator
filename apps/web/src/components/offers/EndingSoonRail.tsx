import { Link } from 'react-router-dom'
import { ArrowRight, Hourglass } from 'lucide-react'
import type { Offer } from '@/types'
import OfferCard from './OfferCard'
import { isEndingSoon, sortOffers } from '@/hooks/useOfferFilters'

/** "Last chance" rail of offers ending within a week, soonest first. */
export default function EndingSoonRail({ offers, viewAllHref }: { offers: Offer[]; viewAllHref: string }) {
  const ending = sortOffers(offers.filter(isEndingSoon), 'ending')
  if (ending.length < 2) return null
  return (
    <section className="rail-section" aria-labelledby="ending-heading">
      <div className="section-heading">
        <h2 id="ending-heading"><Hourglass size={22} aria-hidden="true" className="text-amber-600" /> Ending this week</h2>
        <Link to={viewAllHref} className="section-link">
          See all {ending.length} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <ul className="offer-rail scrollbar-hide">
        {ending.slice(0, 10).map((offer) => (
          <li key={offer.id}><OfferCard offer={offer} /></li>
        ))}
      </ul>
    </section>
  )
}
