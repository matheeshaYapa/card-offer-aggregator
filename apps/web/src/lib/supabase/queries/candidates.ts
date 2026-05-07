import { supabase } from '../client'
import type { CandidateStatus, ScrapedOfferCandidate } from '@/types'
import type { OfferFormInput } from './offers'
import { createOffer } from './offers'

const CANDIDATE_SELECT = `
  *,
  scrape_source:scrape_sources(id, name, source_url)
`

export async function getAllCandidates(
  status?: CandidateStatus | 'all',
): Promise<ScrapedOfferCandidate[]> {
  let query = supabase
    .from('scraped_offer_candidates')
    .select(CANDIDATE_SELECT)
    .order('created_at', { ascending: false })
    .limit(500)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ScrapedOfferCandidate[]
}

export async function getPendingCandidates(): Promise<ScrapedOfferCandidate[]> {
  return getAllCandidates('pending')
}

export async function updateCandidateStatus(
  id: string,
  status: 'approved' | 'rejected' | 'duplicate',
): Promise<void> {
  const { error } = await supabase
    .from('scraped_offer_candidates')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

/**
 * Approve a scraped candidate as a published offer.
 * Creates the offer record, then marks the candidate as approved.
 * The candidate is never deleted — it remains as an audit trail.
 */
export async function approveCandidateAsOffer(
  candidateId: string,
  input: OfferFormInput,
): Promise<string> {
  const offerId = await createOffer(input)
  await updateCandidateStatus(candidateId, 'approved')
  return offerId
}
