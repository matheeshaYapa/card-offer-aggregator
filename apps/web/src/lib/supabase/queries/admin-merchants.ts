import { supabase } from '../client'
import type { Merchant } from '@/types'

export async function getMerchantsAdmin(): Promise<Merchant[]> {
  const { data, error } = await supabase
    .from('merchants')
    .select('*, category:categories(id, name, slug)')
    .order('name')
  if (error) throw error
  return data as Merchant[]
}

export interface MerchantInput {
  name: string
  slug: string
  category_id: string | null
  website_url: string
  country_code: string
  is_active: boolean
}

export async function upsertMerchant(input: MerchantInput, id?: string): Promise<void> {
  const payload = {
    ...input,
    website_url: input.website_url || null,
    category_id: input.category_id || null,
  }
  if (id) {
    const { error } = await supabase.from('merchants').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('merchants').insert(payload)
    if (error) throw error
  }
}

export async function toggleMerchantActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('merchants')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw error
}
