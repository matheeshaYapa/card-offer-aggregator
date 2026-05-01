import type { CardNetwork, CardType } from '@/types'

export function normalizeForSearch(text: string): string {
  return text.toLowerCase().trim()
}

export function formatNetworkName(network: CardNetwork): string {
  const map: Record<CardNetwork, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'Amex',
    other: 'Other',
  }
  return map[network] ?? network
}

export function formatCardTypeName(type: CardType): string {
  return type === 'credit' ? 'Credit' : 'Debit'
}

export function getNetworkColor(network: CardNetwork): string {
  const map: Record<CardNetwork, string> = {
    visa: 'bg-blue-100 text-blue-700',
    mastercard: 'bg-orange-100 text-orange-700',
    amex: 'bg-indigo-100 text-indigo-700',
    other: 'bg-gray-100 text-gray-700',
  }
  return map[network] ?? 'bg-gray-100 text-gray-700'
}

export function getCardTypeColor(type: CardType): string {
  return type === 'credit'
    ? 'bg-primary/10 text-primary'
    : 'bg-emerald-100 text-emerald-700'
}
