import { Link } from 'react-router-dom'
import { Calendar, ArrowRight, Building2 } from 'lucide-react'
import type { Offer } from '@/types'
import Badge from '@/components/common/Badge'
import { formatDate, getDaysRemaining } from '@/utils/dateUtils'

interface OfferCardProps {
  offer: Offer
}

export default function OfferCard({ offer }: OfferCardProps) {
  const category = offer.category
  const merchant = offer.merchant
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

  const daysLeft = getDaysRemaining(offer.valid_to)
  const urgentExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

  return (
    <Link
      to={`/offer/${offer.slug}`}
      className="group block bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden"
    >
      {/* Discount banner */}
      <div className="bg-primary px-4 py-2.5 flex items-center justify-between">
        <span className="text-white font-bold text-lg tracking-tight">
          {offer.discount_text ?? 'Special offer'}
        </span>
        {category && (
          <span className="text-white/80 text-xs font-medium">{category.name}</span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-content text-sm leading-snug mb-1 group-hover:text-primary transition-colors line-clamp-2">
          {offer.title}
        </h3>
        {merchant && (
          <p className="text-xs text-muted mb-3 line-clamp-1">{merchant.name}</p>
        )}

        {/* Bank & network badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {uniqueBanks.slice(0, 2).map((bank) => (
            <Badge key={bank.id} variant="primary" size="sm">
              <Building2 size={10} />
              {bank.short_name ?? bank.name}
            </Badge>
          ))}
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
        <div className="flex items-center justify-between pt-2.5 border-t border-border">
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
