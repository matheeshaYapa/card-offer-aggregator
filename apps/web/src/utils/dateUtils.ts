import type { Offer } from '@/types'

export function isOfferExpired(offer: Pick<Offer, 'valid_to'>): boolean {
  if (!offer.valid_to) return false
  return new Date(offer.valid_to) < new Date(new Date().toDateString())
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return 'Ongoing'
  return new Date(dateString).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getDaysRemaining(validTo?: string | null): number | null {
  if (!validTo) return null
  const diff = new Date(validTo).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getExpiryLabel(offer: Pick<Offer, 'valid_to'>): string {
  if (!offer.valid_to) return 'No expiry'
  const days = getDaysRemaining(offer.valid_to)
  if (days === null) return 'No expiry'
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (days <= 7) return `Expires in ${days} days`
  return `Valid until ${formatDate(offer.valid_to)}`
}
