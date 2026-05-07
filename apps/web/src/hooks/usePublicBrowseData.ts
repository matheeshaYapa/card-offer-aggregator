import { useCallback, useEffect, useState } from 'react'
import { getBanks } from '@/lib/supabase/queries/banks'
import { getCategories } from '@/lib/supabase/queries/categories'
import { getMerchants } from '@/lib/supabase/queries/merchants'
import { getPublicOffers } from '@/lib/supabase/queries/offers'
import type { Bank, Category, Merchant, Offer } from '@/types'

interface PublicBrowseDataState {
  offers: Offer[]
  banks: Bank[]
  categories: Category[]
  merchants: Merchant[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function usePublicBrowseData(): PublicBrowseDataState {
  const [offers, setOffers] = useState<Offer[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [loadedOffers, loadedBanks, loadedCategories, loadedMerchants] =
        await Promise.all([
          getPublicOffers(),
          getBanks(),
          getCategories(),
          getMerchants(),
        ])

      setOffers(loadedOffers)
      setBanks(loadedBanks)
      setCategories(loadedCategories)
      setMerchants(loadedMerchants)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { offers, banks, categories, merchants, loading, error, reload }
}
