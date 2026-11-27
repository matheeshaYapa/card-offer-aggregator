import { Helmet } from 'react-helmet-async'
import type { Offer } from '@/types'
import { SITE_URL, SITE_NAME, canonicalUrl } from '@/utils/seo'

// ── Website (homepage) ────────────────────────────────────────────────────────

export function WebsiteStructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description:
      'Find the best credit and debit card promotions in Sri Lanka. Compare offers from HNB, Commercial Bank, Sampath, BOC and more.',
    url: SITE_URL,
    inLanguage: 'en-LK',
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  )
}

// ── Offer detail page ─────────────────────────────────────────────────────────

interface OfferStructuredDataProps {
  offer: Offer
}

export function OfferStructuredData({ offer }: OfferStructuredDataProps) {
  const primaryBank = offer.offer_bank_rules?.[0]?.bank
  const offerUrl = canonicalUrl(`/offer/${offer.slug}`)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: offer.title,
    description: offer.description ?? offer.title,
    url: offerUrl,
    ...(offer.discount_text && { discount: offer.discount_text }),
    seller: {
      '@type': 'Organization',
      name: offer.merchant?.name ?? 'Various Merchants',
    },
    ...(offer.valid_from && { validFrom: offer.valid_from }),
    ...(offer.valid_to && { validThrough: offer.valid_to }),
    ...(primaryBank && {
      offeredBy: {
        '@type': 'BankOrCreditUnion',
        name: primaryBank.name,
        url: primaryBank.website_url ?? undefined,
      },
    }),
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  )
}

// ── BreadcrumbList ────────────────────────────────────────────────────────────

interface BreadcrumbItem {
  name: string
  url: string
}

interface BreadcrumbStructuredDataProps {
  items: BreadcrumbItem[]
}

export function BreadcrumbStructuredData({ items }: BreadcrumbStructuredDataProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  )
}

// ── Organisation (used sitewide for brand signals) ────────────────────────────

export function OrganisationStructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    description:
      'CardPromo LK aggregates credit and debit card promotions from Sri Lankan banks in one place.',
    areaServed: {
      '@type': 'Country',
      name: 'Sri Lanka',
    },
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  )
}

// ── ItemList (offer listings on home / bank / category pages) ────────────────

export function OfferListStructuredData({ name, url, offers }: { name: string; url: string; offers: Offer[] }) {
  if (offers.length === 0) return null
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url,
    numberOfItems: offers.length,
    itemListElement: offers.slice(0, 30).map((offer, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: canonicalUrl(`/offer/${offer.slug}`),
      name: offer.title,
    })),
  }
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  )
}

// ── FAQPage ──────────────────────────────────────────────────────────────────

export interface FaqItem {
  question: string
  answer: string
}

/** FAQ rich-result markup. Only use for questions that are visible on the page. */
export function FaqStructuredData({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  )
}
