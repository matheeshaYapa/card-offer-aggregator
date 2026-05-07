import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Building2 } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import OfferGrid from '@/components/offers/OfferGrid'
import { getBankBySlug } from '@/lib/supabase/queries/banks'
import { getOffersByBankSlug } from '@/lib/supabase/queries/offers'
import type { Bank, Offer } from '@/types'

export default function BankPage() {
  const { bankSlug } = useParams<{ bankSlug: string }>()
  const [bank, setBank] = useState<Bank | null | undefined>(undefined)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <>
      <MetaTags
        title={`${bankName} Credit Card Promotions`}
        description={`Browse all active ${bankName} credit and debit card promotions in Sri Lanka. Find dining, shopping, travel and supermarket offers.`}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors mb-5"
        >
          <ArrowLeft size={15} />
          All promotions
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content">{bankName}</h1>
            {!loading && (
              <p className="text-sm text-muted">
                {offers.length} active promotion{offers.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
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
