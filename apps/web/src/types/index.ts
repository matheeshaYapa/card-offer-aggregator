/**
 * Domain types used throughout the UI.
 * These are the "joined" shapes returned by Supabase queries with relations.
 */
export type { OfferStatus, OfferSourceType } from './database'

export interface Bank {
  id: string
  country_code: string
  name: string
  slug: string
  short_name: string | null
  website_url: string | null
  logo_url: string | null
  is_active: boolean
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  is_active: boolean
}

export interface Merchant {
  id: string
  country_code: string
  name: string
  slug: string
  category_id: string | null
  website_url: string | null
  logo_url: string | null
  is_active: boolean
}

export type CardType = 'credit' | 'debit'
export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'other'

export interface Card {
  id: string
  bank_id: string
  name: string
  slug: string
  card_type: CardType
  network: CardNetwork
  tier: string | null
  is_active: boolean
  bank?: Bank
}

export interface OfferBankRule {
  id: string
  offer_id: string
  bank_id: string
  card_type: CardType | null
  network: CardNetwork | null
  bank?: Bank
}

export interface OfferCard {
  id: string
  offer_id: string
  card_id: string
  card?: Card
}

export interface Offer {
  id: string
  country_code: string
  title: string
  slug: string
  description: string | null
  discount_text: string | null
  merchant_id: string | null
  category_id: string | null
  valid_from: string | null
  valid_to: string | null
  terms_text: string | null
  source_url: string | null
  source_type: import('./database').OfferSourceType
  status: import('./database').OfferStatus
  is_featured: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  published_at: string | null
  // Joined relations (populated by query functions)
  merchant?: Merchant | null
  category?: Category | null
  offer_bank_rules?: OfferBankRule[]
  offer_cards?: OfferCard[]
}

export type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'duplicate'

export interface ScrapedOfferCandidate {
  id: string
  scrape_run_id: string | null
  scrape_source_id: string | null
  title: string | null
  description: string | null
  raw_text: string | null
  source_url: string | null
  detected_merchant: string | null
  detected_discount: string | null
  detected_valid_from: string | null
  detected_valid_to: string | null
  confidence_score: number | null
  candidate_hash: string | null
  status: CandidateStatus
  created_at: string
  // Joined relation (populated when queried with scrape_sources join)
  scrape_source?: { id: string; bank_id: string | null; name: string; source_url: string } | null
}

export interface ScrapeSource {
  id: string
  bank_id: string | null
  name: string
  source_url: string
  source_type: 'html' | 'pdf'
  is_active: boolean
  last_scraped_at: string | null
  created_at: string
  updated_at: string
}

export type ScrapeRunStatus = 'running' | 'success' | 'failed' | 'partial'

export interface ScrapeRun {
  id: string
  scrape_source_id: string | null
  status: ScrapeRunStatus
  started_at: string
  ended_at: string | null
  offers_found: number
  error_message: string | null
  scrape_source?: Pick<ScrapeSource, 'id' | 'name' | 'source_url'> | null
}

/**
 * Card shape stored in localStorage for selected cards.
 * Denormalised so display works offline without DB refetching.
 */
export interface SelectedCard {
  id: string
  bank_id: string
  bank_name: string
  bank_short_name: string
  name: string
  card_type: CardType
  network: CardNetwork
  slug: string
}

export interface FilterState {
  search: string
  bankSlug: string | null
  categorySlug: string | null
  merchantSlug: string | null
  cardType: CardType | null
  network: CardNetwork | null
  myCardsOnly: boolean
  showExpired: boolean
}
