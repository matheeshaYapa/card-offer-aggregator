import { supabase } from '../client'
import type { Bank } from '@/types'

export async function getBanksAdmin(): Promise<Bank[]> {
  const { data, error } = await supabase
    .from('banks')
    .select('*')
    .order('name')
  if (error) throw error
  return data as Bank[]
}

export interface BankInput {
  name: string
  slug: string
  short_name: string
  website_url: string
  country_code: string
  is_active: boolean
}

export async function upsertBank(input: BankInput, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase
      .from('banks')
      .update(input)
      .eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('banks').insert(input)
    if (error) throw error
  }
}

export async function toggleBankActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('banks')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw error
}
