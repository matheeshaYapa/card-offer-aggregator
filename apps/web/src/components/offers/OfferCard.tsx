import { Link } from 'react-router-dom'
import { Calendar, ArrowRight } from 'lucide-react'
import type { Offer } from '@/types'
import Badge from '@/components/common/Badge'
import { formatDate, getDaysRemaining } from '@/utils/dateUtils'
import { getBankTheme } from '@/utils/bankTheme'
import { getOfferDisplay } from '@/utils/offerDisplay'

interface OfferCardProps {
  offer: Offer
}

export default function OfferCard({ offer }: OfferCardProps) {
  const category = offer.category
  // Deduplicate banks from offer_bank_rules
  const uniqueBanks = Array.from(
    new Map(
      (offer.offer_bank_rules ?? [])
        .filter((r) => r.bank)
        .map((r) => [r.bank!.id, r.bank!]),
    ).values(),
  )
  // Deduplicate networks from offer_bank_rules
  const networks = Array.from(
    new Set(
      (offer.offer_bank_rules ?? [])
        .map((r) => r.network)
        .filter(Boolean) as string[],
    ),
  )

  const primaryTheme = getBankTheme(uniqueBanks[0]?.slug)
  const { headline, detail } = getOfferDisplay(offer)

  const daysLeft = getDaysRemaining(offer.valid_to)
  const urgentExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

  return (
    <Link
      to={`/offer/${offer.slug}`}
      className="group relative flex flex-col bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
    >
      {/* Bank-coloured accent stripe */}
      <span
        className={`absolute left-0 top-0 bottom-0 w-1 ${primaryTheme.stripe}`}
        aria-hidden="true"
      />

      <div className="flex flex-col flex-1 p-4 pl-5">
        {/* Discount + category */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <span
            className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-bold tracking-tight text-white ${primaryTheme.stripe}`}
          >
            {offer.discount_text ?? 'Special offer'}
          </span>
          {category && (
            <span className="shrink-0 mt-0.5 text-[11px] font-medium text-muted bg-slate-100 rounded-full px-2 py-0.5">
              {category.name}
            </span>
          )}
        </div>

        {/* Merchant hero */}
        <h3 className="font-bold text-content text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {headline}
        </h3>
        {detail && (
          <p className="text-xs text-muted mt-1 line-clamp-1">{detail}</p>
        )}

        {/* Bank & network badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {uniqueBanks.slice(0, 2).map((bank) => {
            const theme = getBankTheme(bank.slug)
            return (
              <span
                key={bank.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${theme.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${theme.stripe}`} />
                {bank.short_name ?? bank.name}
              </span>
            )
          })}
          {uniqueBanks.length > 2 && (
            <Badge variant="muted" size="sm">+{uniqueBanks.length - 2} more</Badge>
          )}
          {networks.map((n) => (
            <Badge
              key={n}
              variant={n as 'visa' | 'mastercard' | 'amex' | 'other'}
              size="sm"
            >
              {n.charAt(0).toUpperCase() + n.slice(1)}
            </Badge>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Calendar size={11} />
            {urgentExpiry ? (
              <span className="text-amber-600 font-medium">
                {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
              </span>
            ) : offer.valid_to ? (
              <span>Until {formatDate(offer.valid_to)}</span>
            ) : (
              <span>No expiry</span>
            )}
          </div>
          <ArrowRight size={14} className="text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  )
}
