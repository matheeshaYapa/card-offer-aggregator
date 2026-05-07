import { supabase } from '../client'
import type { Category } from '@/types'

export async function getCategoriesAdmin(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')
  if (error) throw error
  return data as Category[]
}

export interface CategoryInput {
  name: string
  slug: string
  icon: string
  is_active: boolean
}

export async function upsertCategory(input: CategoryInput, id?: string): Promise<void> {
  const payload = { ...input, icon: input.icon || null }
  if (id) {
    const { error } = await supabase.from('categories').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('categories').insert(payload)
    if (error) throw error
  }
}
