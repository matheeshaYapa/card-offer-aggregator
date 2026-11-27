import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Building2, CreditCard, Hourglass, ShieldCheck, Tags } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { OfferListStructuredData, OrganisationStructuredData, WebsiteStructuredData, type FaqItem } from '@/components/seo/StructuredData'
import FaqSection from '@/components/seo/FaqSection'
import SearchInput from '@/components/common/SearchInput'
import OfferBrowser from '@/components/offers/OfferBrowser'
import CategoryTiles from '@/components/offers/CategoryTiles'
import EndingSoonRail from '@/components/offers/EndingSoonRail'
import BankNav from '@/components/offers/BankNav'
import { usePublicBrowseData } from '@/hooks/usePublicBrowseData'
import { usePublicSnapshot } from '@/lib/publicSnapshot'
import { bankLabel, getOfferStats, listJoin, type OfferStats } from '@/utils/offerStats'
import { canonicalUrl, monthYear } from '@/utils/seo'

interface HomePageProps {
  routeMode?: 'home' | 'offers'
}

function homeFaq(stats: OfferStats, month: string): FaqItem[] {
  const topBanks = stats.topBanks.slice(0, 3).map(({ item, count }) => `${bankLabel(item)} (${count})`)
  const topCategories = stats.topCategories.slice(0, 4).map(({ item }) => item.name.toLowerCase())
  return [
    {
      question: 'What card promotions are available in Sri Lanka right now?',
      answer: `In ${month} there are ${stats.total} live credit and debit card promotions from ${stats.bankCount} Sri Lankan banks` +
        (topCategories.length ? `, covering ${listJoin(topCategories)} and more` : '') +
        `. ${stats.installmentCount} are installment plans and ${stats.cashbackCount} are cashback offers. CardPromo LK lists them all in one place and removes offers as soon as they expire.`,
    },
    ...(topBanks.length ? [{
      question: 'Which banks have the most card offers?',
      answer: `Right now ${listJoin(topBanks)} have the most active card promotions. Every bank page on CardPromo LK lists that bank's current offers, filterable by category, card type and network.`,
    }] : []),
    {
      question: 'How do I see only the offers my cards qualify for?',
      answer: 'Add the cards you hold under My Cards — just the bank, card type and network, never a card number — then switch on "My cards only". Your cards are stored only in your browser, with no account needed.',
    },
    {
      question: 'Do card promotions work with debit cards as well as credit cards?',
      answer: `Many do. Of the current offers, ${stats.debitEligible} are open to debit cardholders while ${stats.creditOnly} are for credit cards only. Use the card type filter to see only the offers your card qualifies for.`,
    },
    {
      question: 'How up to date are the offers?',
      answer: "Offers are collected from each bank's official promotions pages, and expired offers are removed automatically. Each offer links to the bank's own page — always confirm the final terms with the bank or merchant before paying.",
    },
    {
      question: 'Is CardPromo LK free and independent?',
      answer: 'Yes. CardPromo LK is a free, independent comparison site. It is not affiliated with any bank, and it never asks for card numbers or personal banking details.',
    },
  ]
}

export default function HomePage({ routeMode = 'home' }: HomePageProps) {
  const snapshot = usePublicSnapshot()
  const { offers, banks, categories, loading, error, reload } = usePublicBrowseData()
  const [params, setParams] = useSearchParams()
  const isOffersRoute = routeMode === 'offers'

  const stats = useMemo(() => getOfferStats(offers), [offers])
  const offerCountBySlug = useMemo(
    () => Object.fromEntries(stats.topBanks.map(({ item, count }) => [item.slug, count])),
    [stats],
  )
  // Month of the data, not of the visitor's clock, so the server HTML and the
  // first client render agree.
  const month = monthYear(snapshot?.generatedAt ?? new Date())
  const count = stats.total
  const faq = useMemo(() => homeFaq(stats, month), [stats, month])

  const title = isOffersRoute
    ? `All Credit & Debit Card Offers in Sri Lanka${count ? ` (${count} live)` : ''}`
    : `Card Promotions in Sri Lanka${count ? `: ${count} Credit & Debit Card Offers` : ' – Credit & Debit Card Offers'}`
  const description = count
    ? `${count} live credit and debit card promotions from ${stats.bankCount} Sri Lankan banks for ${month} — dining, hotels, supermarkets, fuel, online shopping and 0% installment plans. Filter by your bank, card type and offer category.`
    : 'Compare credit and debit card promotions in Sri Lanka — dining, hotels, supermarkets, online shopping and 0% installment plans. Filter by your bank, card type and offer category.'

  const liveCategories = new Set(stats.topCategories.map(({ item }) => item.slug))
  const categoryLink = (slug: string, text: string) =>
    liveCategories.has(slug) ? <Link to={`/category/${slug}`}>{text}</Link> : text

  function setSearch(value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true, preventScrollReset: true })
  }

  return (
    <>
      <MetaTags title={title} description={description} canonical={canonicalUrl(isOffersRoute ? '/offers' : '/')} />
      <WebsiteStructuredData />
      <OrganisationStructuredData />
      <OfferListStructuredData name="Card promotions in Sri Lanka" url={canonicalUrl(isOffersRoute ? '/offers' : '/')} offers={offers} />

      <div className="browse-shell">
        <section className={`browse-hero ${isOffersRoute ? 'browse-hero-compact' : ''}`} aria-labelledby="browse-heading">
          <div className="browse-hero-copy">
            <p className="browse-eyebrow">
              <span className="live-dot" aria-hidden="true" />
              {count ? `${count} live offers · updated ${month}` : 'Sri Lanka · Card offers'}
            </p>
            <h1 id="browse-heading">
              {isOffersRoute ? 'All card offers in Sri Lanka' : <>Card promotions in Sri Lanka, <em>matched to your cards.</em></>}
            </h1>
            <p className="browse-hero-intro" hidden={isOffersRoute}>
              Explore credit and debit card deals from {stats.bankCount || 'participating'} Sri Lankan banks — dining, hotels, supermarkets, fuel and 0% installments. Add your cards to see only the offers you can use.
            </p>
            <div className="browse-search" role="search" aria-label="Card offers">
              <SearchInput
                value={params.get('q') ?? ''}
                onChange={setSearch}
                placeholder="Search a merchant, bank or category"
              />
            </div>
            {count > 0 && (
              <dl className="hero-stats">
                <div><dt><Tags size={15} aria-hidden="true" /> Live offers</dt><dd>{count}</dd></div>
                <div><dt><Building2 size={15} aria-hidden="true" /> Banks</dt><dd>{stats.bankCount}</dd></div>
                <div><dt><Hourglass size={15} aria-hidden="true" /> Ending this week</dt><dd>{stats.endingThisWeek}</dd></div>
              </dl>
            )}
          </div>
          {!isOffersRoute && <div className="hero-card-art" aria-hidden="true">
            <div className="hero-orbit hero-orbit-outer" />
            <div className="hero-orbit hero-orbit-inner" />
            <div className="hero-card hero-card-back"><CreditCard size={34} strokeWidth={1.4} /></div>
            <div className="hero-card hero-card-front">
              <span className="hero-card-chip" />
              <span className="hero-card-brand">CardPromo<span>LK</span></span>
              <span className="hero-card-digits">•••• &nbsp; •••• &nbsp; ••••</span>
              <span className="hero-card-circles" />
            </div>
          </div>}
        </section>

        {!isOffersRoute && <CategoryTiles categories={categories} offers={offers} />}
        {!isOffersRoute && <EndingSoonRail offers={offers} viewAllHref="/offers?ending=true&sort=ending" />}

        <section id="offers" className="browse-results" aria-labelledby="results-heading">
          <div className="browse-results-heading">
            <div>
              <h2 id="results-heading">{isOffersRoute ? 'Browse every offer' : 'All credit & debit card offers'}</h2>
              {count > 0 && <p>{count.toLocaleString('en-LK')} offers from {stats.bankCount} banks — filter by category, offer type or your own cards.</p>}
            </div>
            <a href="#browse-banks" className="browse-directory-link" hidden={banks.length === 0}>Browse by bank</a>
          </div>
          <OfferBrowser
            offers={offers}
            banks={banks}
            categories={categories}
            loading={loading}
            error={error}
            reload={() => void reload()}
          />
        </section>

        {banks.length > 0 && (
          <section id="browse-banks" className="browse-bank-directory" aria-label="Card offers by bank">
            <BankNav banks={banks.filter((bank) => offerCountBySlug[bank.slug])} offerCountBySlug={offerCountBySlug} />
          </section>
        )}

        {!isOffersRoute && (
          <>
            <section className="seo-copy" aria-labelledby="about-heading">
              <h2 id="about-heading">Your guide to card promotions in Sri Lanka</h2>
              <p>
                Sri Lankan banks run hundreds of credit and debit card promotions at any time, but each bank lists them on its own website.
                CardPromo LK brings {count ? `all ${count}` : 'them'} together so you can compare
                deals across {listJoin(stats.topBanks.slice(0, 5).map(({ item }) => bankLabel(item))) || 'every major bank'} without visiting each site.
              </p>
              <p>
                Look for {categoryLink('dining', 'dining offers')} and {categoryLink('travel', 'hotel deals')} for
                weekends away, {categoryLink('supermarket', 'supermarket discounts')} for weekly shopping, and 0% installment
                plans for {categoryLink('electronics', 'electronics')} and {categoryLink('education', 'education')}.
                Add your cards once and switch on “My cards only” to see just the promotions your cards qualify for.
              </p>
              <p className="seo-copy-note">
                <ShieldCheck size={16} aria-hidden="true" /> We never ask for card numbers. Always confirm the final terms with your bank before you pay.
              </p>
            </section>
            <FaqSection title="Card promotions in Sri Lanka: common questions" items={faq} />
          </>
        )}
      </div>
    </>
  )
}
