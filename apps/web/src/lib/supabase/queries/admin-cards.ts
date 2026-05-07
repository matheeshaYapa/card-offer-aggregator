import { supabase } from '../client'
import type { Card } from '@/types'

export async function getCardsAdmin(): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*, bank:banks(*)')
    .order('name')
  if (error) throw error
  return data as Card[]
}

export interface CardInput {
  bank_id: string
  name: string
  slug: string
  card_type: 'credit' | 'debit'
  network: 'visa' | 'mastercard' | 'amex' | 'other'
  tier: string
  is_active: boolean
}

export async function upsertCard(input: CardInput, id?: string): Promise<void> {
  const payload = { ...input, tier: input.tier || null }
  if (id) {
    const { error } = await supabase.from('cards').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('cards').insert(payload)
    if (error) throw error
  }
}

export async function toggleCardActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw error
}
