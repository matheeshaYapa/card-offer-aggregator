import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Building2,
  ExternalLink,
  Tag,
  CreditCard,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import { OfferStructuredData } from '@/components/seo/StructuredData'
import Badge from '@/components/common/Badge'
import { formatDate, getExpiryLabel } from '@/utils/dateUtils'
import { formatNetworkName, formatCardTypeName } from '@/utils/normalization'
import { getOfferBySlug } from '@/lib/supabase/queries/offers'
import type { Offer } from '@/types'

export default function OfferDetailsPage() {
  const { offerSlug } = useParams<{ offerSlug: string }>()
  const navigate = useNavigate()
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!offerSlug) return
    getOfferBySlug(offerSlug)
      .then(setOffer)
      .catch((e) => setFetchError(e instanceof Error ? e.message : 'Failed to load'))
  }, [offerSlug])

  if (offer === undefined && !fetchError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const notFound = !offer

  if (notFound || fetchError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MetaTags title="Offer Not Found" description="This promotion could not be found." noIndex />
        <h1 className="text-lg font-bold text-content mb-2">Offer not found</h1>
        <p className="text-sm text-muted mb-4">
          {fetchError ?? 'This promotion may have expired or been removed.'}
        </p>
        <Link to="/" className="text-sm text-primary underline underline-offset-2">
          Browse all promotions
        </Link>
      </div>
    )
  }

  // offer is guaranteed non-null here
  const banks = Array.from(
    new Map(
      (offer!.offer_bank_rules ?? []).filter((r) => r.bank).map((r) => [r.bank!.id, r.bank!]),
    ).values(),
  )
  const networks = Array.from(new Set(
    (offer!.offer_bank_rules ?? []).map((r) => r.network).filter(Boolean) as string[]
  ))
  const cardTypes = Array.from(new Set(
    (offer!.offer_bank_rules ?? []).map((r) => r.card_type).filter(Boolean) as string[]
  ))
  const explicitCards = Array.from(
    new Map(
      (offer!.offer_cards ?? [])
        .filter((offerCard) => offerCard.card)
        .map((offerCard) => [offerCard.card!.id, offerCard.card!]),
    ).values(),
  )
  const terms = offer!.terms_text ? offer!.terms_text.split('\n').filter(Boolean) : []
  const expiryLabel = getExpiryLabel(offer!)

  return (
    <>
      <MetaTags
        title={`${offer!.title} – ${banks[0]?.short_name ?? banks[0]?.name ?? 'Sri Lanka'}`}
        description={offer!.description ?? offer!.title}
        ogType="article"
      />
      <OfferStructuredData offer={offer!} />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors mb-5"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        <div className="bg-primary rounded-2xl p-6 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white/80 text-xs font-medium mb-1">
                {offer!.merchant?.name ?? 'Various Merchants'}
              </p>
              <h1 className="text-white font-bold text-xl leading-snug">{offer!.title}</h1>
            </div>
            {offer!.discount_text && (
              <div className="shrink-0 bg-white/15 rounded-xl px-3 py-2 text-center">
                <span className="text-white font-black text-2xl leading-none block">
                  {offer!.discount_text.split(' ')[0]}
                </span>
                <span className="text-white/70 text-xs">
                  {offer!.discount_text.split(' ').slice(1).join(' ')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl divide-y divide-border">
          {offer!.description && (
            <div className="p-4">
              <p className="text-sm text-content leading-relaxed">{offer!.description}</p>
            </div>
          )}

          <div className="p-4 flex flex-wrap gap-4">
            {offer!.category && (
              <div className="flex items-start gap-2">
                <Tag size={14} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted">Category</p>
                  <p className="text-sm font-medium text-content">{offer!.category.name}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted">Validity</p>
                <p className="text-sm font-medium text-content">{expiryLabel}</p>
                {offer!.valid_from && (
                  <p className="text-xs text-muted">From {formatDate(offer!.valid_from)}</p>
                )}
              </div>
            </div>
          </div>

          {banks.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Building2 size={13} className="text-muted" />
                <span className="text-xs font-semibold text-content">Eligible Banks</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {banks.map((bank) => (
                  <Link key={bank.id} to={`/bank/${bank.slug}`} className="hover:opacity-80 transition-opacity">
                    <Badge variant="primary" size="md">{bank.name}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(cardTypes.length > 0 || networks.length > 0) && (
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CreditCard size={13} className="text-muted" />
                <span className="text-xs font-semibold text-content">Eligible Cards</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cardTypes.map((t) => (
                  <Badge key={t} variant={t === 'credit' ? 'credit' : 'debit'} size="md">
                    {formatCardTypeName(t as 'credit' | 'debit')}
                  </Badge>
                ))}
                {networks.map((n) => (
                  <Badge key={n} variant={n as 'visa' | 'mastercard' | 'amex'} size="md">
                    {formatNetworkName(n as 'visa' | 'mastercard' | 'amex' | 'other')}
                  </Badge>
                ))}
                {explicitCards.map((card) => (
                  <Badge key={card.id} variant="muted" size="md">
                    {card.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {terms.length > 0 && (
            <div className="p-4">
              <p className="text-xs font-semibold text-content mb-2">Terms &amp; Conditions</p>
              <ul className="space-y-1.5">
                {terms.map((term, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted">
                    <CheckCircle2 size={12} className="text-primary mt-0.5 shrink-0" />
                    {term}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {offer!.source_url && (
            <div className="p-4">
              <a
                href={offer!.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2"
              >
                <ExternalLink size={12} />
                View on bank website
              </a>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Promotion information is collected from public sources and may change without notice.
            Please verify the final offer details with the relevant bank or merchant before making a purchase.
          </p>
        </div>
      </div>
    </>
  )
}
