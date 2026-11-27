import { useCallback, useEffect, useState } from 'react'
import { getBanks } from '@/lib/supabase/queries/banks'
import { getCategories } from '@/lib/supabase/queries/categories'
import { getPublicOffers } from '@/lib/supabase/queries/offers'
import type { Bank, Category, Offer } from '@/types'

interface PublicBrowseDataState {
  offers: Offer[]
  banks: Bank[]
  categories: Category[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function usePublicBrowseData(): PublicBrowseDataState {
  const [offers, setOffers] = useState<Offer[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [loadedOffers, loadedBanks, loadedCategories] =
        await Promise.all([
          getPublicOffers(),
          getBanks(),
          getCategories(),
        ])

      setOffers(loadedOffers)
      setBanks(loadedBanks)
      setCategories(loadedCategories)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { offers, banks, categories, loading, error, reload }
}
