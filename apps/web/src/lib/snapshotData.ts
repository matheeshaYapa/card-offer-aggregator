/**
 * Public data snapshot.
 *
 * At build time scripts/prerender.ts loads every live offer, bank and category
 * once, renders each public page with that data (so search engines receive
 * real content, not "Loading…"), and writes the same data to
 * dist/data/public-<hash>.json. Each prerendered page names that file in
 * <meta name="cardpromo-snapshot">; main.tsx loads it before hydrating, so the
 * browser's first render matches the HTML exactly. Pages then refresh from
 * Supabase in the background (usePublicBrowseData).
 */
import type { Bank, Category, Offer } from '@/types'

export interface PublicSnapshot {
  /** ISO date-time the snapshot was taken. */
  generatedAt: string
  offers: Offer[]
  banks: Bank[]
  categories: Category[]
}

export const SNAPSHOT_META_NAME = 'cardpromo-snapshot'

/** Columns the public UI never reads; dropped to keep the snapshot small. */
const UNUSED_KEYS = new Set([
  'created_at', 'updated_at', 'country_code', 'is_active', 'status', 'offer_id', 'logo_url', 'tier',
])

/** Recursively drop unused columns and empty values from Supabase rows. */
export function slimForSnapshot<T>(value: T): T {
  if (Array.isArray(value)) return value.map(slimForSnapshot) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      if (UNUSED_KEYS.has(key) || item === null || item === undefined) continue
      out[key] = slimForSnapshot(item)
    }
    return out as T
  }
  return value
}
