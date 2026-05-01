import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import OfferGrid from '@/components/offers/OfferGrid'
import { isOfferExpired } from '@/utils/dateUtils'
import categoriesData from '@/data/categories.json'
import offersData from '@/data/offers.json'
import type { Offer } from '@/types'

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  dining: 'Dining promotions for Sri Lankan bank cards. Find discounts at restaurants, buffets and food outlets.',
  shopping: 'Shopping offers for your Sri Lankan credit and debit cards. Save at fashion stores, malls and retailers.',
  travel: 'Travel promotions for Sri Lankan cardholders. Discounts on hotels, resorts and flight bookings.',
  supermarket: 'Supermarket cashback and discounts using Sri Lankan bank cards at Keells, Cargills, Sathosa and more.',
  electronics: 'Electronics offers on credit cards in Sri Lanka. Installment plans and discounts at Abans, Singer and Softlogic.',
}

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>()

  const category = categoriesData.find((c) => c.id === categoryId)

  if (!category) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MetaTags title="Category Not Found" description="This category page could not be found." noIndex />
        <h1 className="text-lg font-bold text-content mb-2">Category not found</h1>
        <Link to="/" className="text-sm text-primary underline underline-offset-2">
          Browse all promotions
        </Link>
      </div>
    )
  }

  const offers = (offersData as Offer[]).filter(
    (o) => o.isActive && !isOfferExpired(o) && o.categoryId === category.id,
  )

  const description =
    CATEGORY_DESCRIPTIONS[category.id] ??
    `${category.name} card promotions in Sri Lanka.`

  return (
    <>
      <MetaTags
        title={`${category.name} Card Offers Sri Lanka`}
        description={description}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors mb-5"
        >
          <ArrowLeft size={15} />
          All promotions
        </Link>

        {/* Category header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-content">
            {category.name} Promotions
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {offers.length} active offer{offers.length !== 1 ? 's' : ''}
          </p>
        </div>

        <OfferGrid offers={offers} />
      </div>
    </>
  )
}
