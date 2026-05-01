export type { Bank } from './bank'
export type { Card, CardType, CardNetwork } from './card'
export type { Category } from './category'
export type { Offer } from './offer'

export interface FilterState {
  search: string
  bankId: string | null
  categoryId: string | null
  cardType: import('./card').CardType | null
  network: import('./card').CardNetwork | null
  myCardsOnly: boolean
  showExpired: boolean
}
