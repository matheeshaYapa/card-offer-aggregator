import type { CardType, CardNetwork } from './card'

export interface Offer {
  id: string
  title: string
  description: string
  bankIds: string[]
  eligibleCardIds?: string[]
  eligibleCardTypes?: CardType[]
  eligibleNetworks?: CardNetwork[]
  merchantName: string
  categoryId: string
  discountText: string
  validFrom?: string
  validTo?: string
  terms?: string[]
  sourceUrl?: string
  imageUrl?: string
  countryCode: string
  isActive: boolean
}
