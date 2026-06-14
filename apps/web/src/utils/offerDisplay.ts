import type { Offer } from '@/types'

export interface OfferDisplay {
  /** The "where" — the merchant/partner, used as the card's bold headline. */
  headline: string
  /** A secondary descriptor (e.g. "Installments"), or null when nothing useful remains. */
  detail: string | null
}

/**
 * Many scraped offers share an identical lead ("Up to 06 months 0% installments
 * at <Merchant>"), which makes every card look the same. The genuinely
 * distinguishing part is the merchant. This helper promotes the merchant to the
 * headline and keeps the offer descriptor (with the duplicated discount text
 * stripped) as a small subtitle.
 */
export function getOfferDisplay(offer: Offer): OfferDisplay {
  const title = (offer.title ?? '').trim()
  const discount = (offer.discount_text ?? '').trim()
  const merchantName = offer.merchant?.name?.trim() || null

  const split = splitAtMerchant(title)
  const headline = merchantName ?? split?.merchant ?? title

  // Detail = the lead descriptor before " at <merchant>". When the merchant
  // came from a DB join, the whole title is the lead.
  let detail: string | null = split ? split.lead : merchantName ? title : null

  if (detail) {
    detail = stripPrefix(detail, discount)
    detail = detail.replace(/^[\s\-–—:,]+/, '').trim()
    if (!detail || detail.toLowerCase() === headline.toLowerCase()) detail = null
  }

  return {
    headline: capitalizeFirst(headline) || 'Special offer',
    detail: detail ? capitalizeFirst(detail) : null,
  }
}

/** Split "<lead> at <merchant>" on the first " at " token. */
function splitAtMerchant(title: string): { lead: string; merchant: string } | null {
  const m = title.match(/^(.*?\S)\s+at\s+(\S.*)$/i)
  if (!m) return null
  return { lead: m[1].trim(), merchant: m[2].trim() }
}

function stripPrefix(text: string, prefix: string): string {
  if (!prefix) return text
  return text.toLowerCase().startsWith(prefix.toLowerCase())
    ? text.slice(prefix.length)
    : text
}

function capitalizeFirst(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}
