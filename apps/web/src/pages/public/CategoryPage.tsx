import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { BreadcrumbStructuredData, OfferListStructuredData } from '@/components/seo/StructuredData'
import FaqSection from '@/components/seo/FaqSection'
import OfferBrowser from '@/components/offers/OfferBrowser'
import { usePublicBrowseData } from '@/hooks/usePublicBrowseData'
import { usePublicSnapshot } from '@/lib/publicSnapshot'
import { getCategoryMeta } from '@/utils/categoryMeta'
import { bankLabel, getOfferStats, listJoin } from '@/utils/offerStats'
import { canonicalUrl, monthYear, SITE_URL } from '@/utils/seo'

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
  automotive:
    'Fuel, tyre, servicing and spare-part offers for Sri Lankan credit and debit cards, including 0% installment plans at auto care centres.',
  education:
    'Pay course and exam fees in 0% installments with Sri Lankan credit cards at campuses, institutes and professional bodies.',
  services:
    'Cashback and discounts on bill payments, couriers, rides and everyday services with Sri Lankan bank cards and payment apps.',
}

export default function CategoryPage() {
  const { categorySlug = '' } = useParams<{ categorySlug: string }>()
  const snapshot = usePublicSnapshot()
  const { offers, banks, categories, loading, error, reload } = usePublicBrowseData()
  const category = categories.find(({ slug }) => slug === categorySlug)
  const categoryOffers = useMemo(
    () => offers.filter((offer) => offer.category?.slug === categorySlug),
    [offers, categorySlug],
  )
  const stats = useMemo(() => getOfferStats(categoryOffers), [categoryOffers])

  if (!loading && !category) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MetaTags title="Category Not Found" description="This category page could not be found." noIndex />
        <h1 className="text-lg font-bold text-content mb-2">Category not found</h1>
        <Link to="/" className="text-sm text-primary underline underline-offset-2">Browse all promotions</Link>
      </div>
    )
  }

  const catName = category?.name ?? 'Category'
  const lower = catName.toLowerCase()
  const count = categoryOffers.length
  const month = monthYear(snapshot?.generatedAt ?? new Date())
  const pageCanonical = canonicalUrl(`/category/${categorySlug}`)
  const { icon: Icon, iconColor } = getCategoryMeta(categorySlug)
  const intro =
    CATEGORY_DESCRIPTIONS[categorySlug] ??
    `${catName} card promotions in Sri Lanka. Discover credit and debit card offers available at ${lower} merchants.`
  const topBanks = stats.topBanks.slice(0, 4)
  const description = count
    ? `${count} ${lower} card offers in Sri Lanka for ${month} from ${listJoin(topBanks.map(({ item }) => bankLabel(item)))}. ${intro}`.slice(0, 300)
    : intro
  const faq = count ? [
    {
      question: `Which banks have ${lower} card offers in Sri Lanka?`,
      answer: `In ${month}, ${listJoin(stats.topBanks.map(({ item, count: n }) => `${bankLabel(item)} (${n})`))} have ${lower} promotions for their credit and debit cards.`,
    },
    {
      question: `How many ${lower} card promotions are there right now?`,
      answer: `There are ${count} live ${lower} offers` +
        (stats.installmentCount ? `, including ${stats.installmentCount} 0% installment plans` : '') +
        (stats.endingThisWeek ? `. ${stats.endingThisWeek} of them end within the next 7 days` : '') +
        '. The list is refreshed daily from the banks\' own promotion pages.',
    },
  ] : []

  return (
    <>
      <MetaTags
        title={`${catName} Card Offers in Sri Lanka${count ? `: ${count} Credit & Debit Card Promotions` : ''}`}
        description={description}
        canonical={pageCanonical}
        noIndex={!loading && count === 0}
      />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: SITE_URL },
          { name: `${catName} offers`, url: pageCanonical },
        ]}
      />
      <OfferListStructuredData name={`${catName} card offers in Sri Lanka`} url={pageCanonical} offers={categoryOffers} />

      <div className="browse-shell">
        <Link to="/" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> All promotions</Link>

        <header className="landing-hero">
          <span className={`landing-hero-icon ${iconColor}`}><Icon size={28} aria-hidden="true" /></span>
          <div>
            <h1>{catName} card offers in Sri Lanka</h1>
            <p className="landing-hero-meta">
              {loading ? 'Loading offers…' : `${count} live ${count === 1 ? 'offer' : 'offers'} from ${stats.bankCount} ${stats.bankCount === 1 ? 'bank' : 'banks'} · updated ${month}`}
            </p>
            <p className="landing-hero-intro">{intro}</p>
            {topBanks.length > 1 && (
              <p className="landing-hero-links">
                Top banks:{' '}
                {topBanks.map(({ item, count: n }, index) => (
                  <span key={item.slug}>
                    {index > 0 && ' · '}
                    <Link to={`/bank/${item.slug}`}>{bankLabel(item)} ({n})</Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        </header>

        <OfferBrowser
          offers={offers}
          banks={banks}
          categories={categories}
          loading={loading}
          error={error}
          reload={() => void reload()}
          lockedCategory={categorySlug}
        />

        <FaqSection title={`${catName} card offers: common questions`} items={faq} />
      </div>
    </>
  )
}
