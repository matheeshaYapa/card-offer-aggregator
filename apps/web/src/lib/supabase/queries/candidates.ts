import { supabase } from '../client'
import type { CandidateStatus, ScrapedOfferCandidate } from '@/types'
import type { OfferFormInput } from './offers'
import { createOffer } from './offers'
import { slugify } from '@/utils/slugUtils'

const BASE_CANDIDATE_SELECT = `
  *,
  scrape_source:scrape_sources(id, bank_id, name, source_url),
  offer:offers(id, slug, status, is_active)
`
// detected_category_id is added by migration 010; until it is applied the
// join fails, so getAllCandidates() falls back to the base select.
const CANDIDATE_SELECT = `${BASE_CANDIDATE_SELECT.trimEnd()},
  detected_category:categories(id, name, slug)
`

export async function getAllCandidates(
  status?: CandidateStatus | 'all',
): Promise<ScrapedOfferCandidate[]> {
  const run = (select: string) => {
    let query = supabase
      .from('scraped_offer_candidates')
      .select(select)
      .order('created_at', { ascending: false })
      .limit(2500)
    if (status && status !== 'all') query = query.eq('status', status)
    return query
  }

  let { data, error } = await run(CANDIDATE_SELECT)
  if (error && /detected_category|relationship|PGRST200|42703/i.test(`${error.code} ${error.message}`)) {
    ;({ data, error } = await run(BASE_CANDIDATE_SELECT))
  }
  if (error) throw error
  return (data ?? []) as unknown as ScrapedOfferCandidate[]
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
    .update({ status, review_source: 'admin' })
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
    .update({ status, review_source: 'admin' })
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
    .update({ status: 'approved', offer_id: offerId, review_source: 'admin' })
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
    category_id: c.detected_category_id ?? null,
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

/** Checks that block publishing whatever the score. Keep in sync with HARD_FLAGS in scrapers/src/confidence.py. */
export const HARD_QUALITY_FLAGS = new Set([
  'placeholder_title', 'generic_title', 'benefit_not_in_text', 'implausible_benefit', 'batch_anomaly',
])

/** Human-readable labels for scraper quality flags. Mirrors FLAG_LABELS in scrapers/src/confidence.py. */
export const QUALITY_FLAG_LABELS: Record<string, string> = {
  placeholder_title: 'Title is a placeholder or template',
  generic_title: 'Title is a page heading, not an offer',
  benefit_not_in_text: "Benefit not found in the bank's text",
  implausible_benefit: 'Benefit value looks implausible',
  duplicate_title: 'Several offers share this title',
  vague_benefit: "Benefit has no value (e.g. 'Special offer')",
  far_future_end: 'End date is unusually far ahead',
  joined_words: 'Title has words run together',
  long_title: 'Title is unusually long',
  starts_far_ahead: 'Starts more than 90 days from now',
  no_merchant: 'No merchant detected',
  no_category: 'No category detected',
  boilerplate_description: 'Description was page boilerplate (removed)',
  batch_anomaly: 'Most offers from this source failed checks',
}

export function isPublishable(c: ScrapedOfferCandidate): boolean {
  return (c.confidence_score ?? 0) >= AUTO_PUBLISH_THRESHOLD &&
    !(c.quality_flags ?? []).some((flag) => HARD_QUALITY_FLAGS.has(flag))
}

/**
 * Publish high-confidence (>= 80%) candidates as live, approved offers
 * immediately. Candidates below the threshold, or with a failed hard check,
 * are skipped (left pending).
 *
 * Uses Promise.allSettled so one failure won't abort the rest.
 */
export async function bulkPublishHighConfidence(
  candidates: ScrapedOfferCandidate[],
): Promise<{ published: number; skipped: number; failed: number }> {
  const eligible = candidates.filter(isPublishable)
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
