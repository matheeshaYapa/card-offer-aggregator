import { supabase } from '../client'
import type { Merchant } from '@/types'

export async function getMerchants(): Promise<Merchant[]> {
  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return data as Merchant[]
}
