import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, Tag } from 'lucide-react'
import type { Offer } from '@/types'
import { getDaysRemaining, getExpiryLabel } from '@/utils/dateUtils'
import { getBankTheme } from '@/utils/bankTheme'
import { getOfferDisplay, getOfferTypes, OFFER_TYPES, parseDiscount } from '@/utils/offerDisplay'
import { getOfferBanks } from '@/utils/offerMatching'
import { formatNetworkName } from '@/utils/normalization'

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
  const typeLabel = OFFER_TYPES.find(({ id }) => id === getOfferTypes(offer)[0])?.label

  const daysLeft = getDaysRemaining(offer.valid_to)
  const urgentExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

  return (
    <Link
      to={`/offer/${offer.slug}`}
      state={{ browsePath: pathname + search }}
      className="group flex flex-col min-h-[240px] bg-white rounded-2xl border border-border overflow-hidden transition-shadow hover:border-primary/45 hover:shadow-[0_8px_22px_rgba(18,63,51,0.08)]"
    >
      <div className={`flex items-start gap-3 min-w-0 px-4 py-4 ${theme.tileBg} ${theme.tileText}`}>
        <div className="grid place-items-center shrink-0 bg-white/70 size-9 rounded-lg">
          <Tag size={17} aria-hidden="true" />
        </div>
        <div className="min-w-0 self-center">
          <p className="text-[1.35rem] font-extrabold tracking-tight leading-tight break-words">{big}</p>
          {small && <p className="text-[.82rem] font-semibold leading-snug break-words">{small}</p>}
        </div>
      </div>
      <div className="flex flex-col flex-1 p-4">
        {(category || typeLabel) && (
          <p className="mb-1.5 text-[.82rem] font-semibold text-muted">{category?.name ?? typeLabel}</p>
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
