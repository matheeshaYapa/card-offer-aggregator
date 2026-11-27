import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
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
import { OfferStructuredData, BreadcrumbStructuredData } from '@/components/seo/StructuredData'
import Badge from '@/components/common/Badge'
import { formatDate, getExpiryLabel } from '@/utils/dateUtils'
import { formatNetworkName, formatCardTypeName } from '@/utils/normalization'
import { getOfferBySlug } from '@/lib/supabase/queries/offers'
import type { Offer } from '@/types'
import { canonicalUrl, SITE_URL } from '@/utils/seo'
import { getBankTheme } from '@/utils/bankTheme'
import { getOfferDisplay, parseDiscount } from '@/utils/offerDisplay'
import { getOfferBanks } from '@/utils/offerMatching'

export default function OfferDetailsPage() {
  const { offerSlug } = useParams<{ offerSlug: string }>()
  const { state } = useLocation()
  const browsePath = typeof state?.browsePath === 'string' && /^\/(?!\/)/.test(state.browsePath) ? state.browsePath : '/'
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!offerSlug) return
    let current = true
    setOffer(undefined)
    setFetchError(null)
    getOfferBySlug(offerSlug)
      .then((loaded) => { if (current) setOffer(loaded) })
      .catch((error) => { if (current) setFetchError(error instanceof Error ? error.message : 'Failed to load') })
    return () => { current = false }
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
  const banks = getOfferBanks(offer!)
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

  const primaryBankName = banks[0]?.short_name ?? banks[0]?.name ?? 'Sri Lanka'
  const headerTheme = getBankTheme(banks[0]?.slug)
  const merchantLabel = offer!.merchant?.name ?? getOfferDisplay(offer!).headline
  const { big: discountBig, small: discountSmall } = parseDiscount(offer!.discount_text)
  const pageCanonical = canonicalUrl(`/offer/${offer!.slug}`)
  const metaDescription =
    offer!.description ??
    `${offer!.title}. ${offer!.discount_text ? `Discount: ${offer!.discount_text}. ` : ''}Valid for ${primaryBankName} cardholders in Sri Lanka.`

  return (
    <>
      <MetaTags
        title={`${offer!.title} – ${primaryBankName}`}
        description={metaDescription}
        canonical={pageCanonical}
        ogType="article"
      />
      <OfferStructuredData offer={offer!} />
      <BreadcrumbStructuredData
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Offers', url: `${SITE_URL}/offers` },
          { name: offer!.title, url: pageCanonical },
        ]}
      />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link
          to={browsePath}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors mb-5"
        >
          <ArrowLeft size={15} />
          Back to offers
        </Link>

        <div className={`${headerTheme.tileBg} ${headerTheme.tileText} rounded-[18px] p-6 sm:p-8 mb-5`}>
          <div className="flex flex-col sm:flex-row sm:justify-between items-start gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold mb-2">
                {merchantLabel}
              </p>
              <h1 className="text-content font-extrabold text-2xl sm:text-3xl tracking-tight leading-snug [text-wrap:pretty]">
                {offer!.title}
              </h1>
            </div>
            {offer!.discount_text && (
              <div className="sm:max-w-[38%] bg-white/65 rounded-[14px] px-4 py-3">
                <span className="font-black text-[1.45rem] leading-tight block">
                  {discountBig}
                </span>
                {discountSmall && (
                  <span className="text-sm">{discountSmall}</span>
                )}
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

          {offer.source_type === 'scraped' && !cardTypes.length && !networks.length && !explicitCards.length && (
            <p className="p-4 text-sm text-muted">Check the bank’s offer page for eligible cards.</p>
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
                {banks.map((bank) => {
                  const t = getBankTheme(bank.slug)
                  return (
                    <Link
                      key={bank.id}
                      to={`/bank/${bank.slug}`}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${t.badge} hover:opacity-80 transition-opacity`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.stripe}`} />
                      {bank.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {(cardTypes.length > 0 || networks.length > 0 || explicitCards.length > 0) && (
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

          {offer!.source_url && /^https?:\/\//i.test(offer!.source_url) && (
            <div className="p-4">
              <a
                href={offer!.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="browse-action"
              >
                <ExternalLink size={15} className="mr-2" aria-hidden="true" />
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
