import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Building2, ExternalLink } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { BreadcrumbStructuredData, OfferListStructuredData } from '@/components/seo/StructuredData'
import FaqSection from '@/components/seo/FaqSection'
import OfferBrowser from '@/components/offers/OfferBrowser'
import BankNav from '@/components/offers/BankNav'
import { usePublicBrowseData } from '@/hooks/usePublicBrowseData'
import { usePublicSnapshot } from '@/lib/publicSnapshot'
import { isOfferMatchingBankSlug } from '@/utils/offerMatching'
import { bankLabel, getOfferStats, listJoin } from '@/utils/offerStats'
import { canonicalUrl, monthYear, SITE_URL } from '@/utils/seo'
import { getBankTheme } from '@/utils/bankTheme'

/** Short SEO copy per bank. Keep natural — no keyword stuffing. */
const BANK_SEO_COPY: Record<string, string> = {
  'commercial-bank':
    'Commercial Bank of Ceylon offers a wide range of credit and debit card promotions across dining, travel, supermarkets, and online shopping in Sri Lanka. Explore all active ComBank card offers below.',
  hnb:
    'Hatton National Bank (HNB) runs regular credit card promotions for dining, lifestyle, jewellery, and supermarket purchases in Sri Lanka. View current HNB card offers and save on your next purchase.',
  'sampath-bank':
    'Sampath Bank credit and debit card promotions cover hotels, restaurants, supermarkets, and healthcare in Sri Lanka. Find the latest Sampath card offers and discounts here.',
  boc:
    'Bank of Ceylon (BOC) card promotions include cashback, installment plans, and discounts at fuel stations, supermarkets, and retailers across Sri Lanka.',
  'peoples-bank':
    "People's Bank credit and debit card offers provide savings at selected merchants, supermarkets, and online platforms in Sri Lanka.",
}

export default function BankPage() {
  const { bankSlug = '' } = useParams<{ bankSlug: string }>()
  const snapshot = usePublicSnapshot()
  const { offers, banks, categories, loading, error, reload } = usePublicBrowseData()
  const bank = banks.find(({ slug }) => slug === bankSlug)
  const bankOffers = useMemo(
    () => offers.filter((offer) => isOfferMatchingBankSlug(offer, bankSlug)),
    [offers, bankSlug],
  )
  const stats = useMemo(() => getOfferStats(bankOffers), [bankOffers])
  const allStats = useMemo(() => getOfferStats(offers), [offers])
  const bankCounts = Object.fromEntries(allStats.topBanks.map(({ item, count }) => [item.slug, count]))

  if (!loading && !bank) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MetaTags title="Bank Not Found" description="This bank page could not be found." noIndex />
        <h1 className="text-lg font-bold text-content mb-2">Bank not found</h1>
        <Link to="/" className="text-sm text-primary underline underline-offset-2">Browse all promotions</Link>
      </div>
    )
  }

  const bankName = bank?.name ?? 'Bank'
  const shortName = bank ? bankLabel(bank) : 'Bank'
  const count = bankOffers.length
  const month = monthYear(snapshot?.generatedAt ?? new Date())
  const theme = getBankTheme(bankSlug)
  const pageCanonical = canonicalUrl(`/bank/${bankSlug}`)
  const seoCopy =
    BANK_SEO_COPY[bankSlug] ??
    `Browse all active ${bankName} credit and debit card promotions in Sri Lanka. Find dining, shopping, travel and supermarket offers.`
  const topCategories = stats.topCategories.slice(0, 5)
  const description = count
    ? (`${count} live ${shortName} credit and debit card offers for ${month}` +
      (topCategories.length ? ` — ${listJoin(topCategories.map(({ item }) => item.name.toLowerCase()))}` : '') +
      `. ${seoCopy}`).slice(0, 300)
    : seoCopy
  const faq = count ? [
    {
      question: `What ${shortName} card offers are available right now?`,
      answer: `${bankName} has ${count} live card promotions in ${month}` +
        (topCategories.length ? `, mostly ${listJoin(topCategories.slice(0, 3).map(({ item, count: n }) => `${item.name.toLowerCase()} (${n})`))}` : '') +
        (stats.installmentCount ? `, plus ${stats.installmentCount} installment plans` : '') + '.',
    },
    {
      question: `Can I use ${shortName} debit cards for these promotions?`,
      answer: `${stats.debitEligible} of ${shortName}'s current offers are open to debit cardholders; ${stats.creditOnly} are for credit cards only. Use the card type filter to see the ones your card qualifies for.`,
    },
  ] : []

  return (
    <>
      <MetaTags
        title={`${shortName} Credit & Debit Card Offers${count ? `: ${count} Promotions (${month})` : ' in Sri Lanka'}`}
        description={description}
        canonical={pageCanonical}
        noIndex={!loading && count === 0}
      />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: SITE_URL },
          { name: `${shortName} card offers`, url: pageCanonical },
        ]}
      />
      <OfferListStructuredData name={`${bankName} card offers`} url={pageCanonical} offers={bankOffers} />

      <div className="browse-shell">
        <Link to="/" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> All promotions</Link>

        <header className={`landing-hero ${theme.tileBg}`}>
          <span className={`landing-hero-icon ${theme.stripe} text-white`}><Building2 size={26} aria-hidden="true" /></span>
          <div className={theme.tileText}>
            <h1>{shortName} credit &amp; debit card offers</h1>
            <p className="landing-hero-meta">
              {loading ? 'Loading offers…' : `${count} live ${count === 1 ? 'promotion' : 'promotions'} · updated ${month}`}
            </p>
            <p className="landing-hero-intro">{seoCopy}</p>
            {bank?.website_url && (
              <p className="landing-hero-links">
                <a href={bank.website_url} target="_blank" rel="noopener noreferrer nofollow">
                  {bankName} website <ExternalLink size={13} aria-hidden="true" className="inline" />
                </a>
              </p>
            )}
          </div>
        </header>

        <div className="mb-5">
          <BankNav banks={banks.filter((item) => bankCounts[item.slug])} variant="pills" activeSlug={bankSlug} />
        </div>

        <OfferBrowser
          offers={offers}
          banks={banks}
          categories={categories}
          loading={loading}
          error={error}
          reload={() => void reload()}
          lockedBank={bankSlug}
        />

        <FaqSection title={`${shortName} card offers: common questions`} items={faq} />
      </div>
    </>
  )
}
