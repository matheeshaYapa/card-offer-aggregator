import { useCallback, useEffect, useState } from 'react'
import { getBanks } from '@/lib/supabase/queries/banks'
import { getCategories } from '@/lib/supabase/queries/categories'
import { getPublicOffers } from '@/lib/supabase/queries/offers'
import { usePublicSnapshot } from '@/lib/publicSnapshot'
import type { Bank, Category, Offer } from '@/types'

interface BrowseData {
  offers: Offer[]
  banks: Bank[]
  categories: Category[]
}

interface PublicBrowseDataState extends BrowseData {
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

// One live fetch per page load, shared by every page and component that asks.
// Navigating home → bank → category reuses it instead of refetching.
let liveRequest: Promise<BrowseData> | null = null
let liveData: BrowseData | null = null

function fetchLive(force = false): Promise<BrowseData> {
  if (!liveRequest || force) {
    liveRequest = Promise.all([getPublicOffers(), getBanks(), getCategories()])
      .then(([offers, banks, categories]) => (liveData = { offers, banks, categories }))
      .catch((error) => {
        liveRequest = null
        throw error
      })
  }
  return liveRequest
}

/**
 * Offers, banks and categories for public pages.
 *
 * Starts from the build-time snapshot when there is one (prerendered pages),
 * so the first render matches the server HTML and nothing flashes "Loading…".
 * Then refreshes from Supabase in the background; if that fails, the snapshot
 * stays on screen and no error is shown.
 */
export function usePublicBrowseData(): PublicBrowseDataState {
  const snapshot = usePublicSnapshot()
  const initial = liveData ?? snapshot
  const [data, setData] = useState<BrowseData>(() => initial ?? { offers: [], banks: [], categories: [] })
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force: boolean) => {
    if (!initial) setLoading(true)
    setError(null)
    try {
      setData(await fetchLive(force))
    } catch (err) {
      if (!initial) setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [initial])

  useEffect(() => {
    void load(false)
  }, [load])

  const reload = useCallback(() => load(true), [load])
  return { ...data, loading, error, reload }
}
