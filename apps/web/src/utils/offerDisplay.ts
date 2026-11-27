import type { Offer, OfferType } from '@/types'

export const OFFER_TYPES: { id: OfferType; label: string; short: string }[] = [
  { id: 'discount', label: 'Discounts', short: 'Discount' },
  { id: 'cashback', label: 'Cashback', short: 'Cashback' },
  { id: 'installment', label: '0% installments', short: '0% installments' },
  { id: 'bonus', label: 'Free extras', short: 'Free extra' },
]

/**
 * Rough size of the benefit for "Biggest saving" ordering: the largest
 * percentage in the benefit text (cashback counts the same as a discount),
 * a small score for installment plans and free extras, 0 when unknown.
 */
export function getBenefitValue(offer: Offer): number {
  const text = offer.discount_text ?? ''
  const percents = [...text.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 100)
  if (percents.length) return Math.max(...percents)
  if (/rs\.?|lkr/i.test(text)) return 5
  const types = getOfferTypes(offer)
  if (types.includes('bonus')) return 3
  if (types.includes('installment')) return 1
  return 0
}

export function getOfferTypes(offer: Offer): OfferType[] {
  const text = [offer.title, offer.discount_text, offer.description].filter(Boolean).join(' ')
  const types: OfferType[] = []
  if (/\bcash[ -]*back\b/i.test(text)) types.push('cashback')
  if (/\b(?:instal{1,2}ments?|payment plans?|interest[ -]free|0\s*% interest)\b/i.test(text)) types.push('installment')
  if (/\b(?:complimentary|bogo|b1g1|free (?:delivery|shipping|upgrades?))\b|\bbuy\s+(?:one|\d+)\s+get\b|^free\b/i.test(text)) types.push('bonus')
  if (!types.includes('cashback') && (
    /\b(?:off|discounts?|savings?)\b/i.test(text) ||
    (!types.length && /[1-9]\d*(?:\.\d+)?\s*%/.test(offer.discount_text ?? ''))
  )) types.push('discount')
  return types
}

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

export interface ParsedDiscount {
  /** The large headline token, e.g. "20%", "0%", "B1G1", "Free", "Rs.1,000". */
  big: string
  /** The small trailing unit, e.g. "off", "cashback", "for 12 months". */
  small: string
}

/**
 * Split a discount string into a big headline token + a small unit, for the
 * deal-first card. Best-effort over the messy scraped `discount_text` values.
 *
 *   "20% off"                     → { big: "20%",     small: "off" }
 *   "Up to 35% off"               → { big: "35%",     small: "off" }
 *   "10% cashback"                → { big: "10%",     small: "cashback" }
 *   "0% installment for 12 months"→ { big: "0%",      small: "installment for 12 months" }
 *   "Buy 1 Get 1 Free"            → { big: "B1G1",    small: "free" }
 *   "Rs. 1,000 off"               → { big: "Rs.1,000",small: "off" }
 */
export function parseDiscount(discountText: string | null | undefined): ParsedDiscount {
  const text = (discountText ?? '').trim()
  if (!text) return { big: 'Special', small: 'offer' }

  // Buy-one-get-one variants.
  if (/\b(bogo|b1g1|buy\s*1\s*get\s*1|buy\s*one\s*get\s*one)\b/i.test(text)) {
    return { big: 'B1G1', small: 'free' }
  }

  // Percentage (optionally "up to N%").
  const pct = text.match(/^(up\s+to\s+)?(\d+(?:\.\d+)?)\s*%/i)
  if (pct) {
    const big = `${pct[1] ? 'Up to ' : ''}${pct[2]}%`
    const small = text
      .slice(pct[0].length)
      .replace(/^[\s·—-]+/, '')
      .trim()
    return { big, small }
  }

  // Rupee amount.
  const rs = text.match(/^(up\s+to\s+)?(?:Rs\.?|LKR)\s*([\d,]+(?:\.\d+)?)/i)
  if (rs) {
    const rest = text.slice(rs[0].length).replace(/^[\s·—-]+/, '').trim()
    return { big: `${rs[1] ? 'Up to ' : ''}Rs. ${rs[2]}`, small: rest }
  }

  // "Free …" (free delivery, free upgrade, …).
  const free = text.match(/^free\b\s*(.*)$/i)
  if (free) return { big: 'Free', small: free[1].trim() }

  // Fallback: first word is the headline, rest is the unit.
  const [firstWord, ...rest] = text.split(/\s+/)
  return { big: firstWord, small: rest.join(' ') }
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
