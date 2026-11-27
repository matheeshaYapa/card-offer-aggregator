import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Building2 } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { BreadcrumbStructuredData } from '@/components/seo/StructuredData'
import OfferGrid from '@/components/offers/OfferGrid'
import BankNav from '@/components/offers/BankNav'
import { getBankBySlug, getBanks } from '@/lib/supabase/queries/banks'
import { getOffersByBankSlug } from '@/lib/supabase/queries/offers'
import type { Bank, Offer } from '@/types'
import { canonicalUrl, SITE_URL } from '@/utils/seo'
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
  const { bankSlug } = useParams<{ bankSlug: string }>()
  const [bank, setBank] = useState<Bank | null | undefined>(undefined)
  const [offers, setOffers] = useState<Offer[]>([])
  const [allBanks, setAllBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load the full bank list once for the cross-bank navigation strip.
  useEffect(() => {
    getBanks()
      .then(setAllBanks)
      .catch(() => setAllBanks([]))
  }, [])

  const loadPage = useCallback(async () => {
    if (!bankSlug) return
    setLoading(true)
    setError(null)
    setBank(undefined)
    setOffers([])

    try {
      const [loadedBank, loadedOffers] = await Promise.all([
        getBankBySlug(bankSlug),
        getOffersByBankSlug(bankSlug),
      ])
      setBank(loadedBank)
      setOffers(loadedBank ? loadedOffers : [])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load bank offers')
    } finally {
      setLoading(false)
    }
  }, [bankSlug])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  if (!loading && error && bank === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MetaTags
          title="Bank Offers Unavailable"
          description="This bank offer page could not be loaded."
          noIndex
        />
        <h1 className="text-lg font-bold text-content mb-2">
          Unable to load bank offers
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

  if (!loading && !bank) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MetaTags title="Bank Not Found" description="This bank page could not be found." noIndex />
        <h1 className="text-lg font-bold text-content mb-2">Bank not found</h1>
        <Link to="/" className="text-sm text-primary underline underline-offset-2">
          Browse all promotions
        </Link>
      </div>
    )
  }

  const bankName = bank?.name ?? 'Bank'
  const theme = getBankTheme(bankSlug)
  const pageCanonical = canonicalUrl(`/bank/${bankSlug}`)
  const seoCopy =
    (bankSlug && BANK_SEO_COPY[bankSlug]) ??
    `Browse all active ${bankName} credit and debit card promotions in Sri Lanka. Find dining, shopping, travel and supermarket offers.`

  return (
    <>
      <MetaTags
        title={`${bankName} Credit Card Promotions Sri Lanka`}
        description={seoCopy}
        canonical={pageCanonical}
      />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: SITE_URL },
          { name: `${bankName} Promotions`, url: pageCanonical },
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

        {/* Bank hero — tinted with the bank's theme colour */}
        <div className={`${theme.tileBg} rounded-2xl p-6 mb-5`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-[46px] h-[46px] rounded-xl ${theme.stripe} flex items-center justify-center shrink-0`}>
              <Building2 size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-[22px] font-extrabold ${theme.tileText}`}>{bankName}</h1>
              {!loading && (
                <p className={`text-sm ${theme.tileText} opacity-75`}>
                  {offers.length} active promotion{offers.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          {!loading && bank && (
            <p className={`mt-3.5 text-sm leading-relaxed ${theme.tileText} opacity-90 max-w-2xl`}>
              {seoCopy}
            </p>
          )}
        </div>

        {/* Cross-bank navigation — jump to another bank's offers */}
        <div className="mb-5">
          <BankNav banks={allBanks} variant="pills" activeSlug={bankSlug} />
        </div>

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
