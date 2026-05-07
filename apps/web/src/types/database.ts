/**
 * Raw database row types — mirror the Supabase schema exactly.
 * Do not use these directly in UI; prefer the domain types in index.ts.
 */

export interface DbCountry {
  id: string
  code: string
  name: string
  is_active: boolean
  created_at: string
}

export interface DbBank {
  id: string
  country_code: string
  name: string
  slug: string
  short_name: string | null
  website_url: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbCategory {
  id: string
  name: string
  slug: string
  icon: string | null
  is_active: boolean
  created_at: string
}

export interface DbMerchant {
  id: string
  country_code: string
  name: string
  slug: string
  category_id: string | null
  website_url: string | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbCard {
  id: string
  bank_id: string
  name: string
  slug: string
  card_type: 'credit' | 'debit'
  network: 'visa' | 'mastercard' | 'amex' | 'other'
  tier: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type OfferStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'expired'

export type OfferSourceType =
  | 'manual'
  | 'scraped'
  | 'imported'
  | 'bank_submission'

export interface DbOffer {
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
  source_type: OfferSourceType
  status: OfferStatus
  is_featured: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface DbOfferCard {
  id: string
  offer_id: string
  card_id: string
}

export interface DbOfferBankRule {
  id: string
  offer_id: string
  bank_id: string
  card_type: 'credit' | 'debit' | null
  network: 'visa' | 'mastercard' | 'amex' | 'other' | null
}

export interface DbScrapeSource {
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

export interface DbScrapeRun {
  id: string
  scrape_source_id: string
  status: 'running' | 'success' | 'failed' | 'partial'
  started_at: string
  ended_at: string | null
  offers_found: number
  error_message: string | null
}

export interface DbScrapedOfferCandidate {
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
  status: 'pending' | 'approved' | 'rejected' | 'duplicate'
  created_at: string
}

export interface DbAdminUser {
  id: string
  user_id: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}
