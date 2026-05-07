import { supabase } from '../client'
import type { Bank } from '@/types'

export async function getBanks(): Promise<Bank[]> {
  const { data, error } = await supabase
    .from('banks')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data as Bank[]
}

export async function getBankBySlug(slug: string): Promise<Bank | null> {
  const { data, error } = await supabase
    .from('banks')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data as Bank | null
}
