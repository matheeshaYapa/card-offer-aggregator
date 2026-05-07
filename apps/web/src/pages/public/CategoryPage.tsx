import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { BreadcrumbStructuredData } from '@/components/seo/StructuredData'
import OfferGrid from '@/components/offers/OfferGrid'
import { getCategoryBySlug } from '@/lib/supabase/queries/categories'
import { getOffersByCategorySlug } from '@/lib/supabase/queries/offers'
import type { Category, Offer } from '@/types'
import { canonicalUrl, SITE_URL } from '@/utils/seo'

/** SEO copy per category slug. Natural language — no stuffing. */
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  dining:
    'Find dining promotions for Sri Lankan credit and debit cards. Enjoy discounts and cashback at restaurants, hotels, and food outlets across the island with cards from HNB, Commercial Bank, Sampath, and more.',
  shopping:
    'Browse shopping offers for Sri Lankan bank cards. Get discounts and installment plans at fashion stores, malls, and retailers using your credit or debit card.',
  travel:
    'Explore travel promotions for Sri Lankan cardholders. Save on hotels, resorts, and flight bookings with special rates available on selected credit cards.',
  supermarket:
    'Supermarket cashback and discounts with Sri Lankan bank cards. Save at Keells Super, Cargills Food City, Sathosa, and Laugfs supermarkets every week.',
  electronics:
    'Electronics offers on credit cards in Sri Lanka. Get 0% installment plans and discounts at Abans, Singer, and Softlogic using your bank card.',
  lifestyle:
    'Lifestyle card promotions in Sri Lanka covering gyms, spas, salons, and entertainment. Use your credit or debit card to save on leisure activities.',
  online:
    'Online shopping offers for Sri Lankan credit and debit cards. Get cashback, discounts, and free delivery at popular e-commerce platforms.',
  healthcare:
    'Healthcare and pharmacy discounts for Sri Lankan cardholders. Use your bank card to save at hospitals, pharmacies, and medical centres.',
}

export default function CategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>()
  const [category, setCategory] = useState<Category | null | undefined>(undefined)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(async () => {
    if (!categorySlug) return
    setLoading(true)
    setError(null)
    setCategory(undefined)
    setOffers([])

    try {
      const [loadedCategory, loadedOffers] = await Promise.all([
        getCategoryBySlug(categorySlug),
        getOffersByCategorySlug(categorySlug),
      ])
      setCategory(loadedCategory)
      setOffers(loadedCategory ? loadedOffers : [])
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to load category offers',
      )
    } finally {
      setLoading(false)
    }
  }, [categorySlug])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  if (!loading && error && category === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MetaTags
          title="Category Offers Unavailable"
          description="This category page could not be loaded."
          noIndex
        />
        <h1 className="text-lg font-bold text-content mb-2">
          Unable to load category offers
        </h1>
        <p className="text-sm text-muted mb-4">{error}</p>
        <button
          onClick={() => void loadPage()}
          className="text-sm text-primary underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!loading && !category) {
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

  const catName = category?.name ?? 'Category'
  const pageCanonical = canonicalUrl(`/category/${categorySlug}`)
  const description =
    (categorySlug && CATEGORY_DESCRIPTIONS[categorySlug]) ??
    `${catName} card promotions in Sri Lanka. Discover credit and debit card offers available at ${catName.toLowerCase()} merchants.`

  return (
    <>
      <MetaTags
        title={`${catName} Card Offers Sri Lanka`}
        description={description}
        canonical={pageCanonical}
      />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: SITE_URL },
          { name: `${catName} Offers`, url: pageCanonical },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors mb-5"
        >
          <ArrowLeft size={15} />
          All promotions
        </Link>

        <div className="mb-3">
          <h1 className="text-xl font-bold text-content">{catName} Promotions</h1>
          {!loading && (
            <p className="text-sm text-muted mt-0.5">
              {offers.length} active offer{offers.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* SEO description paragraph — rendered for both crawlers and visitors */}
        {!loading && category && (
          <p className="text-sm text-muted leading-relaxed mb-5 max-w-2xl">{description}</p>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1 min-w-0">{error}</span>
            <button
              onClick={() => void loadPage()}
              className="text-xs font-medium underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        <OfferGrid offers={offers} loading={loading} />
      </div>
    </>
  )
}
