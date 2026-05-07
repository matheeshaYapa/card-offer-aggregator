import { Helmet } from 'react-helmet-async'
import type { Offer } from '@/types'

interface OfferStructuredDataProps {
  offer: Offer
}

export function OfferStructuredData({ offer }: OfferStructuredDataProps) {
  // Derive the primary bank from offer_bank_rules relations
  const primaryBank = offer.offer_bank_rules?.[0]?.bank

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: offer.title,
    description: offer.description,
    discount: offer.discount_text,
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
      },
    }),
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  )
}

interface WebsiteStructuredDataProps {
  siteUrl?: string
}

export function WebsiteStructuredData({
  siteUrl = 'https://cardpromo.lk',
}: WebsiteStructuredDataProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CardPromo LK',
    description: 'Find promotions for your Sri Lankan credit and debit cards.',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  )
}
