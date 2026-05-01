import { Link } from 'react-router-dom'
import { Calendar, ArrowRight, Building2 } from 'lucide-react'
import type { Offer } from '@/types'
import Badge from '@/components/common/Badge'
import { formatDate, getDaysRemaining, isOfferExpired } from '@/utils/dateUtils'
import banksData from '@/data/banks.json'
import categoriesData from '@/data/categories.json'

interface OfferCardProps {
  offer: Offer
}

export default function OfferCard({ offer }: OfferCardProps) {
  const bank = banksData.find((b) => offer.bankIds[0] === b.id)
  const category = categoriesData.find((c) => c.id === offer.categoryId)
  const expired = isOfferExpired(offer)
  const daysLeft = getDaysRemaining(offer.validTo)
  const urgentExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

  return (
    <Link
      to={`/offer/${offer.id}`}
      className={`group block bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30
        transition-all duration-200 overflow-hidden ${expired ? 'opacity-60' : ''}`}
    >
      {/* Discount banner */}
      <div className="bg-primary px-4 py-2.5 flex items-center justify-between">
        <span className="text-white font-bold text-lg tracking-tight">
          {offer.discountText}
        </span>
        {category && (
          <span className="text-white/80 text-xs font-medium">
            {category.name}
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Merchant & title */}
        <h3 className="font-semibold text-content text-sm leading-snug mb-1 group-hover:text-primary transition-colors line-clamp-2">
          {offer.title}
        </h3>
        <p className="text-xs text-muted mb-3 line-clamp-1">
          {offer.merchantName}
        </p>

        {/* Bank & network badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {offer.bankIds.slice(0, 2).map((bankId) => {
            const b = banksData.find((x) => x.id === bankId)
            return b ? (
              <Badge key={bankId} variant="primary" size="sm">
                <Building2 size={10} />
                {b.shortName}
              </Badge>
            ) : null
          })}
          {offer.bankIds.length > 2 && (
            <Badge variant="muted" size="sm">
              +{offer.bankIds.length - 2} more
            </Badge>
          )}
          {offer.eligibleNetworks?.map((n) => (
            <Badge key={n} variant={n as 'visa' | 'mastercard' | 'amex'} size="sm">
              {n.charAt(0).toUpperCase() + n.slice(1)}
            </Badge>
          ))}
        </div>

        {/* Footer: validity + arrow */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Calendar size={11} />
            {expired ? (
              <span className="text-danger font-medium">Expired</span>
            ) : urgentExpiry ? (
              <span className="text-amber-600 font-medium">
                {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
              </span>
            ) : (
              <span>Until {formatDate(offer.validTo)}</span>
            )}
          </div>
          <ArrowRight
            size={14}
            className="text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>
    </Link>
  )
}
