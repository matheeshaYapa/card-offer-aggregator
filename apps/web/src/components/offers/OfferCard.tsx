import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, Hourglass, Tag } from 'lucide-react'
import type { Offer } from '@/types'
import { getDaysRemaining, getExpiryLabel } from '@/utils/dateUtils'
import { getBankTheme } from '@/utils/bankTheme'
import { getOfferDisplay, getOfferTypes, OFFER_TYPES, parseDiscount } from '@/utils/offerDisplay'
import { getOfferBanks } from '@/utils/offerMatching'
import { formatNetworkName } from '@/utils/normalization'
import { OFFER_TYPE_ICONS } from './OfferToolbar'

interface OfferCardProps {
  offer: Offer
}

export default function OfferCard({ offer }: OfferCardProps) {
  const { pathname, search } = useLocation()
  const category = offer.category
  const uniqueBanks = getOfferBanks(offer)
  const networks = [...new Set([
    ...(offer.offer_bank_rules ?? []).map(({ network }) => network),
    ...(offer.offer_cards ?? []).map(({ card }) => card?.network),
  ])].filter((network) => network != null)

  const theme = getBankTheme(uniqueBanks[0]?.slug)
  const { headline, detail } = getOfferDisplay(offer)
  const { big, small } = parseDiscount(offer.discount_text)
  const primaryType = getOfferTypes(offer)[0]
  const typeLabel = OFFER_TYPES.find(({ id }) => id === primaryType)?.short
  const TypeIcon = primaryType ? OFFER_TYPE_ICONS[primaryType] : Tag

  const daysLeft = getDaysRemaining(offer.valid_to)
  const urgentExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

  return (
    <Link
      to={`/offer/${offer.slug}`}
      state={{ browsePath: pathname + search }}
      className="group flex flex-col min-h-[240px] bg-white rounded-2xl border border-border overflow-hidden transition-shadow hover:border-primary/45 hover:shadow-[0_8px_22px_rgba(18,63,51,0.08)]"
    >
      <div className={`relative flex items-start gap-3 min-w-0 px-4 py-4 ${theme.tileBg} ${theme.tileText}`}>
        <div className="grid place-items-center shrink-0 bg-white/70 size-10 rounded-xl" title={typeLabel}>
          <TypeIcon size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0 self-center">
          <p className="text-[1.45rem] font-extrabold tracking-tight leading-tight break-words">{big}</p>
          {small && <p className="text-[.82rem] font-semibold leading-snug break-words line-clamp-2">{small}</p>}
        </div>
        {urgentExpiry && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[.7rem] font-bold text-amber-700 shadow-sm">
            <Hourglass size={11} aria-hidden="true" /> Last few days
          </span>
        )}
      </div>
      <div className="flex flex-col flex-1 p-4">
        {(category || typeLabel) && (
          <p className="mb-1.5 text-[.8rem] font-semibold text-muted">
            {[category?.name, typeLabel].filter(Boolean).join(' · ')}
          </p>
        )}
        <h3 className="font-bold text-content text-base leading-snug [text-wrap:pretty] group-hover:text-primary transition-colors line-clamp-2">
          {headline}
        </h3>
        {detail && (
          <p className="text-sm text-muted mt-1 line-clamp-2">{detail}</p>
        )}

        {/* Bank & network badges — no dots (the stripe/tint already encodes the bank) */}
        <div className="flex flex-wrap gap-1.5 mt-3 mb-3.5">
          {uniqueBanks.slice(0, 2).map((bank) => {
            const t = getBankTheme(bank.slug)
            return (
              <span
                key={bank.id}
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.badge}`}
              >
                {bank.short_name ?? bank.name}
              </span>
            )
          })}
          {uniqueBanks.length > 2 && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-muted">
              +{uniqueBanks.length - 2} more
            </span>
          )}
          {networks.map((n) => (
            <span
              key={n}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600"
            >
              {formatNetworkName(n)}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-auto pt-3 border-t border-border">
          <span
            className={`flex items-center gap-1.5 text-xs ${
              urgentExpiry ? 'text-amber-700 font-semibold' : 'text-muted'
            }`}
          >
            <CalendarDays size={14} aria-hidden="true" />
            {getExpiryLabel(offer)}
          </span>
          <span className="text-xs font-bold text-primary group-hover:underline underline-offset-4">View offer</span>
        </div>
      </div>
    </Link>
  )
}
