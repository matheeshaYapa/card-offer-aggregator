/**
 * Cleanup queries — remove offers and scraped candidates that have been
 * expired for more than CLEANUP_DAYS days.
 *
 * "Expired" means valid_to (or detected_valid_to for candidates) is a date
 * strictly before today. Records with NULL valid_to are never cleaned up —
 * we don't know when they expire, so we keep them.
 *
 * Admin-only: relies on RLS policies that grant `for all` to is_admin().
 */
import { supabase } from '../client'

/** Records expired this many days ago (or more) become eligible for deletion. */
export const CLEANUP_DAYS = 7

/** ISO date string for the cleanup cut-off (today − CLEANUP_DAYS). */
function getCutoffDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - CLEANUP_DAYS)
  return d.toISOString().split('T')[0]
}

export interface CleanupCounts {
  offers: number
  candidates: number
}

/** Count offers + candidates that would be deleted by cleanupExpired(). */
export async function getExpiredCleanupCounts(): Promise<CleanupCounts> {
  const cutoff = getCutoffDate()

  const [{ count: offerCount, error: oErr }, { count: candCount, error: cErr }] = await Promise.all([
    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .not('valid_to', 'is', null)
      .lt('valid_to', cutoff),
    supabase
      .from('scraped_offer_candidates')
      .select('id', { count: 'exact', head: true })
      .not('detected_valid_to', 'is', null)
      .lt('detected_valid_to', cutoff),
  ])

  if (oErr) throw oErr
  if (cErr) throw cErr

  return {
    offers: offerCount ?? 0,
    candidates: candCount ?? 0,
  }
}

/**
 * Delete offers + candidates whose valid_to expired more than CLEANUP_DAYS
 * ago. Related offer_bank_rules and offer_cards cascade automatically.
 * Returns the number of rows deleted from each table.
 */
export async function cleanupExpired(): Promise<CleanupCounts> {
  const cutoff = getCutoffDate()

  const { data: deletedOffers, error: oErr } = await supabase
    .from('offers')
    .delete()
    .not('valid_to', 'is', null)
    .lt('valid_to', cutoff)
    .select('id')
  if (oErr) throw oErr

  const { data: deletedCandidates, error: cErr } = await supabase
    .from('scraped_offer_candidates')
    .delete()
    .not('detected_valid_to', 'is', null)
    .lt('detected_valid_to', cutoff)
    .select('id')
  if (cErr) throw cErr

  return {
    offers: deletedOffers?.length ?? 0,
    candidates: deletedCandidates?.length ?? 0,
  }
}
