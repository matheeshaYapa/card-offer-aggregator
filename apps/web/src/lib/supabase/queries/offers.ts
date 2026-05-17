import { supabase } from '../client'
import type { Offer } from '@/types'
import { isOfferMatchingBankSlug } from '@/utils/offerMatching'
import { getCategoryBySlug } from './categories'

const OFFER_SELECT = `
  *,
  merchant:merchants(*),
  category:categories(*),
  offer_bank_rules(
    *,
    bank:banks(*)
  ),
  offer_cards(
    *,
    card:cards(
      *,
      bank:banks(*)
    )
  )
`

/** Fetch all public (approved, active, non-expired) offers */
export async function getPublicOffers(): Promise<Offer[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .eq('status', 'approved')
    .eq('is_active', true)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Offer[]
}

/** Fetch a single public offer by slug */
export async function getOfferBySlug(slug: string): Promise<Offer | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_active', true)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .maybeSingle()
  if (error) throw error
  return data as Offer | null
}

/** Fetch public offers filtered by bank slug */
export async function getOffersByBankSlug(bankSlug: string): Promise<Offer[]> {
  const offers = await getPublicOffers()
  return offers.filter((offer) => isOfferMatchingBankSlug(offer, bankSlug))
}

/** Fetch public offers filtered by category slug */
export async function getOffersByCategorySlug(
  categorySlug: string,
): Promise<Offer[]> {
  const category = await getCategoryBySlug(categorySlug)
  if (!category) return []

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .eq('status', 'approved')
    .eq('is_active', true)
    .eq('category_id', category.id)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Offer[]
}

// ── Admin queries (require authenticated admin session) ──────────────────

export async function getAllOffersAdmin(): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Offer[]
}

export async function getOfferByIdAdmin(id: string): Promise<Offer | null> {
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as Offer | null
}

export async function updateOfferStatus(
  id: string,
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'expired',
) {
  const { error } = await supabase
    .from('offers')
    .update({
      status,
      ...(status === 'approved' ? { published_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)
  if (error) throw error
}

export async function toggleOfferActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('offers')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw error
}

/**
 * Update the status of multiple offers in a single Supabase query.
 * Sets published_at when status changes to 'approved'.
 */
export async function bulkUpdateOfferStatus(
  ids: string[],
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'expired',
): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('offers')
    .update({
      status,
      ...(status === 'approved' ? { published_at: new Date().toISOString() } : {}),
    })
    .in('id', ids)
  if (error) throw error
}

export interface OfferBankRuleInput {
  bank_id: string
  card_type: 'credit' | 'debit' | null
  network: 'visa' | 'mastercard' | 'amex' | 'other' | null
}

export interface OfferFormInput {
  title: string
  slug: string
  description: string
  discount_text: string
  merchant_id: string | null
  category_id: string | null
  valid_from: string | null
  valid_to: string | null
  terms_text: string
  source_url: string
  source_type: import('@/types').OfferSourceType
  status: import('@/types').OfferStatus
  is_featured: boolean
  is_active: boolean
  country_code: string
  bank_rules: OfferBankRuleInput[]
  card_ids: string[]
}

export async function createOffer(input: OfferFormInput): Promise<string> {
  const { data: offer, error } = await supabase
    .from('offers')
    .insert({
      title: input.title,
      slug: input.slug,
      description: input.description || null,
      discount_text: input.discount_text || null,
      merchant_id: input.merchant_id,
      category_id: input.category_id,
      valid_from: input.valid_from || null,
      valid_to: input.valid_to || null,
      terms_text: input.terms_text || null,
      source_url: input.source_url || null,
      source_type: input.source_type,
      status: input.status,
      is_featured: input.is_featured,
      is_active: input.is_active,
      country_code: input.country_code,
      published_at: input.status === 'approved' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error) throw error
  const offerId = (offer as { id: string }).id

  if (input.bank_rules.length > 0) {
    const { error: re } = await supabase.from('offer_bank_rules').insert(
      input.bank_rules.map((r) => ({
        offer_id: offerId,
        bank_id: r.bank_id,
        card_type: r.card_type,
        network: r.network,
      })),
    )
    if (re) throw re
  }

  if (input.card_ids.length > 0) {
    const { error: ce } = await supabase.from('offer_cards').insert(
      input.card_ids.map((card_id) => ({ offer_id: offerId, card_id })),
    )
    if (ce) throw ce
  }

  return offerId
}

export async function updateOffer(
  id: string,
  input: OfferFormInput,
  wasApproved: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('offers')
    .update({
      title: input.title,
      slug: input.slug,
      description: input.description || null,
      discount_text: input.discount_text || null,
      merchant_id: input.merchant_id,
      category_id: input.category_id,
      valid_from: input.valid_from || null,
      valid_to: input.valid_to || null,
      terms_text: input.terms_text || null,
      source_url: input.source_url || null,
      source_type: input.source_type,
      status: input.status,
      is_featured: input.is_featured,
      is_active: input.is_active,
      ...(!wasApproved && input.status === 'approved'
        ? { published_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', id)
  if (error) throw error

  // Replace bank rules
  await supabase.from('offer_bank_rules').delete().eq('offer_id', id)
  if (input.bank_rules.length > 0) {
    const { error: re } = await supabase.from('offer_bank_rules').insert(
      input.bank_rules.map((r) => ({
        offer_id: id,
        bank_id: r.bank_id,
        card_type: r.card_type,
        network: r.network,
      })),
    )
    if (re) throw re
  }

  // Replace card links
  await supabase.from('offer_cards').delete().eq('offer_id', id)
  if (input.card_ids.length > 0) {
    const { error: ce } = await supabase.from('offer_cards').insert(
      input.card_ids.map((card_id) => ({ offer_id: id, card_id })),
    )
    if (ce) throw ce
  }
}
