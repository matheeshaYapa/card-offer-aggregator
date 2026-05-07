import { supabase } from '../client'
import type { Card } from '@/types'

export async function getCards(bankId?: string): Promise<Card[]> {
  let query = supabase
    .from('cards')
    .select('*, bank:banks(*)')
    .eq('is_active', true)
    .order('name')

  if (bankId) query = query.eq('bank_id', bankId)

  const { data, error } = await query
  if (error) throw error
  return data as Card[]
}

export async function getCardsByBankSlug(bankSlug: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*, bank:banks!inner(*)')
    .eq('is_active', true)
    .eq('banks.slug', bankSlug)
    .order('name')
  if (error) throw error
  return data as Card[]
}
