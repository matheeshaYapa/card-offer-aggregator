export type CardType = 'credit' | 'debit'
export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'other'

export interface Card {
  id: string
  bankId: string
  name: string
  type: CardType
  network: CardNetwork
  tier?: string
}
