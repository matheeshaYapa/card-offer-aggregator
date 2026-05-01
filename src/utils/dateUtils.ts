import type { Offer } from '@/types'

export function isOfferExpired(offer: Offer): boolean {
  if (!offer.validTo) return false
  return new Date(offer.validTo) < new Date(new Date().toDateString())
}

export function isOfferNotStarted(offer: Offer): boolean {
  if (!offer.validFrom) return false
  return new Date(offer.validFrom) > new Date()
}

export function formatDate(dateString?: string): string {
  if (!dateString) return 'Ongoing'
  return new Date(dateString).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getDaysRemaining(validTo?: string): number | null {
  if (!validTo) return null
  const diff = new Date(validTo).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getExpiryLabel(offer: Offer): string {
  if (!offer.validTo) return 'No expiry'
  const days = getDaysRemaining(offer.validTo)
  if (days === null) return 'No expiry'
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (days <= 7) return `Expires in ${days} days`
  return `Valid until ${formatDate(offer.validTo)}`
}
