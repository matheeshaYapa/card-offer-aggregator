import { supabase } from '../client'
import type { CandidateStatus, ScrapedOfferCandidate } from '@/types'
import type { OfferFormInput } from './offers'
import { createOffer } from './offers'
import { slugify } from '@/utils/slugUtils'

const CANDIDATE_SELECT = `
  *,
  scrape_source:scrape_sources(id, bank_id, name, source_url),
  offer:offers(id, slug, status, is_active)
`

export async function getAllCandidates(
  status?: CandidateStatus | 'all',
): Promise<ScrapedOfferCandidate[]> {
  let query = supabase
    .from('scraped_offer_candidates')
    .select(CANDIDATE_SELECT)
    .order('created_at', { ascending: false })
    .limit(2500)

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
 * Update the status of multiple candidates in a single Supabase query.
 * More efficient than calling updateCandidateStatus() N times.
 */
export async function bulkUpdateCandidateStatus(
  ids: string[],
  status: 'rejected' | 'duplicate',
): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('scraped_offer_candidates')
    .update({ status })
    .in('id', ids)
  if (error) throw error
}

/**
 * Approve a scraped candidate as a published offer.
 * Creates the offer record, then marks the candidate as approved and links
 * it to the new offer for audit purposes.
 * The candidate is never deleted — it remains as an audit trail.
 */
export async function approveCandidateAsOffer(
  candidateId: string,
  input: OfferFormInput,
): Promise<string> {
  const offerId = await createOffer(input)
  const { error } = await supabase
    .from('scraped_offer_candidates')
    .update({ status: 'approved', offer_id: offerId })
    .eq('id', candidateId)
  if (error) throw error
  return offerId
}

/**
 * Build the OfferFormInput for a candidate, mapping detected fields and
 * deriving a unique slug from its title. `index` is used alongside a
 * timestamp + random suffix so concurrently-generated slugs never collide.
 * `overrides` lets callers customise status/visibility (e.g. for auto-publish).
 */
function buildOfferInputFromCandidate(
  c: ScrapedOfferCandidate,
  index: number,
  overrides: Partial<OfferFormInput> = {},
): OfferFormInput {
  const title = c.title?.trim() || 'Untitled Offer'
  const uniqueSuffix =
    Date.now().toString(36) + index.toString(36) + Math.random().toString(36).slice(2, 5)
  const slug = slugify(title).slice(0, 60) + '-' + uniqueSuffix
  // Auto-add a broad bank rule from the scrape source so the offer
  // is immediately associated with the correct bank.
  const sourceBankId = c.scrape_source?.bank_id ?? null
  const bankRules = sourceBankId
    ? [{ bank_id: sourceBankId, card_type: null, network: null }]
    : []

  return {
    title,
    slug,
    discount_text: c.detected_discount ?? '',
    description: c.description ?? '',
    merchant_id: null,
    category_id: null,
    valid_from: c.detected_valid_from ?? null,
    valid_to: c.detected_valid_to ?? null,
    source_url: c.source_url ?? '',
    source_type: 'scraped',
    status: 'pending_review',
    terms_text: '',
    is_featured: false,
    is_active: true,
    country_code: 'LK',
    bank_rules: bankRules,
    card_ids: [],
    ...overrides,
  }
}

/**
 * Bulk-approve multiple candidates as draft offers in a single operation.
 * Each offer is created with status='pending_review' so nothing is published
 * immediately — the admin can review and edit them in the Offers page.
 * Bank rules and merchant associations are left empty for manual completion.
 *
 * Uses Promise.allSettled so one failure won't abort the rest.
 */
export async function bulkApproveAsOffers(
  candidates: ScrapedOfferCandidate[],
): Promise<{ approved: number; failed: number }> {
  const results = await Promise.allSettled(
    candidates.map((c, i) => approveCandidateAsOffer(c.id, buildOfferInputFromCandidate(c, i))),
  )
  return {
    approved: results.filter((r) => r.status === 'fulfilled').length,
    failed:   results.filter((r) => r.status === 'rejected').length,
  }
}

/** Candidates at or above this confidence are eligible for instant publishing. */
const AUTO_PUBLISH_THRESHOLD = 0.8

/**
 * Publish high-confidence (>= 80%) candidates as live, approved offers
 * immediately. Candidates below the threshold are skipped (left pending).
 *
 * Uses Promise.allSettled so one failure won't abort the rest.
 */
export async function bulkPublishHighConfidence(
  candidates: ScrapedOfferCandidate[],
): Promise<{ published: number; skipped: number; failed: number }> {
  const eligible = candidates.filter(
    (c) => (c.confidence_score ?? 0) >= AUTO_PUBLISH_THRESHOLD,
  )
  const skipped = candidates.length - eligible.length

  const results = await Promise.allSettled(
    eligible.map((c, i) =>
      approveCandidateAsOffer(
        c.id,
        buildOfferInputFromCandidate(c, i, { status: 'approved', is_active: true }),
      ),
    ),
  )
  return {
    published: results.filter((r) => r.status === 'fulfilled').length,
    skipped,
    failed:    results.filter((r) => r.status === 'rejected').length,
  }
}
