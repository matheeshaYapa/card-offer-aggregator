import type { Offer } from '../types'

const sriLankaCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Colombo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function sriLankaDate(now = new Date()): string {
  const parts = new Map(sriLankaCalendar.formatToParts(now).map(({ type, value }) => [type, value]))
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`
}

export function isOfferExpired(offer: Pick<Offer, 'valid_to'>): boolean {
  if (!offer.valid_to) return false
  return offer.valid_to < sriLankaDate()
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return 'Ongoing'
  return new Date(dateString).toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Colombo',
  })
}

export function getDaysRemaining(validTo?: string | null): number | null {
  if (!validTo) return null
  const diff = Date.parse(validTo) - Date.parse(sriLankaDate())
  return diff / 86_400_000
}

export function getExpiryLabel(offer: Pick<Offer, 'valid_to'>): string {
  if (!offer.valid_to) return 'End date unlisted'
  const days = getDaysRemaining(offer.valid_to)
  if (days === null) return 'End date unlisted'
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (days <= 7) return `Expires in ${days} days`
  return `Valid until ${formatDate(offer.valid_to)}`
}
