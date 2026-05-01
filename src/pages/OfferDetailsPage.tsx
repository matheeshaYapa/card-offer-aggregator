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
import { formatDate, isOfferExpired, getExpiryLabel } from '@/utils/dateUtils'
import { formatNetworkName, formatCardTypeName } from '@/utils/normalization'
import offersData from '@/data/offers.json'
import banksData from '@/data/banks.json'
import categoriesData from '@/data/categories.json'
import type { Offer } from '@/types'

export default function OfferDetailsPage() {
  const { offerId } = useParams<{ offerId: string }>()
  const navigate = useNavigate()

  const offer = (offersData as Offer[]).find((o) => o.id === offerId)

  if (!offer) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MetaTags title="Offer Not Found" description="This promotion could not be found." noIndex />
        <h1 className="text-lg font-bold text-content mb-2">Offer not found</h1>
        <p className="text-sm text-muted mb-4">
          This promotion may have expired or been removed.
        </p>
        <Link to="/" className="text-sm text-primary underline underline-offset-2">
          Browse all promotions
        </Link>
      </div>
    )
  }

  const banks = banksData.filter((b) => offer.bankIds.includes(b.id))
  const category = categoriesData.find((c) => c.id === offer.categoryId)
  const expired = isOfferExpired(offer)
  const expiryLabel = getExpiryLabel(offer)

  return (
    <>
      <MetaTags
        title={`${offer.title} – ${banks[0]?.shortName ?? 'Sri Lanka'}`}
        description={offer.description}
        ogType="article"
      />
      <OfferStructuredData offer={offer} />

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors mb-5"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Hero banner */}
        <div
          className={`rounded-2xl p-6 mb-5 ${expired ? 'bg-slate-500' : 'bg-primary'}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              {expired && (
                <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-medium px-2 py-0.5 rounded-full mb-2">
                  <AlertCircle size={10} />
                  Expired
                </span>
              )}
              <p className="text-white/80 text-xs font-medium mb-1">
                {offer.merchantName}
              </p>
              <h1 className="text-white font-bold text-xl leading-snug">
                {offer.title}
              </h1>
            </div>
            <div className="shrink-0 bg-white/15 rounded-xl px-3 py-2 text-center">
              <span className="text-white font-black text-2xl leading-none block">
                {offer.discountText.split(' ')[0]}
              </span>
              <span className="text-white/70 text-xs">
                {offer.discountText.split(' ').slice(1).join(' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Details card */}
        <div className="bg-white border border-border rounded-2xl divide-y divide-border">
          {/* Description */}
          <div className="p-4">
            <p className="text-sm text-content leading-relaxed">
              {offer.description}
            </p>
          </div>

          {/* Category & validity */}
          <div className="p-4 flex flex-wrap gap-4">
            {category && (
              <div className="flex items-start gap-2">
                <Tag size={14} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted">Category</p>
                  <p className="text-sm font-medium text-content">
                    {category.name}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Calendar size={14} className="text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted">Validity</p>
                <p
                  className={`text-sm font-medium ${expired ? 'text-danger' : 'text-content'}`}
                >
                  {expiryLabel}
                </p>
                {offer.validFrom && (
                  <p className="text-xs text-muted">
                    From {formatDate(offer.validFrom)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Banks */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 size={13} className="text-muted" />
              <span className="text-xs font-semibold text-content">
                Eligible Banks
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {banks.map((bank) => (
                <Link
                  key={bank.id}
                  to={`/bank/${bank.id}`}
                  className="hover:opacity-80 transition-opacity"
                >
                  <Badge variant="primary" size="md">
                    {bank.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>

          {/* Eligible cards */}
          {(offer.eligibleCardTypes?.length ||
            offer.eligibleNetworks?.length) && (
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CreditCard size={13} className="text-muted" />
                <span className="text-xs font-semibold text-content">
                  Eligible Cards
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {offer.eligibleCardTypes?.map((t) => (
                  <Badge
                    key={t}
                    variant={t === 'credit' ? 'credit' : 'debit'}
                    size="md"
                  >
                    {formatCardTypeName(t)}
                  </Badge>
                ))}
                {offer.eligibleNetworks?.map((n) => (
                  <Badge
                    key={n}
                    variant={n as 'visa' | 'mastercard' | 'amex'}
                    size="md"
                  >
                    {formatNetworkName(n)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Terms */}
          {offer.terms && offer.terms.length > 0 && (
            <div className="p-4">
              <p className="text-xs font-semibold text-content mb-2">
                Terms &amp; Conditions
              </p>
              <ul className="space-y-1.5">
                {offer.terms.map((term, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted">
                    <CheckCircle2 size={12} className="text-primary mt-0.5 shrink-0" />
                    {term}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Source link */}
          {offer.sourceUrl && (
            <div className="p-4">
              <a
                href={offer.sourceUrl}
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

        {/* Disclaimer */}
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Promotion information is collected from public sources and may
            change without notice. Please verify the final offer details with
            the relevant bank or merchant before making a purchase.
          </p>
        </div>
      </div>
    </>
  )
}
