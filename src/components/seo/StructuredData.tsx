import { Helmet } from 'react-helmet-async'
import type { Offer } from '@/types'
import { formatDate } from '@/utils/dateUtils'
import banksData from '@/data/banks.json'

interface OfferStructuredDataProps {
  offer: Offer
}

export function OfferStructuredData({ offer }: OfferStructuredDataProps) {
  const bank = banksData.find((b) => offer.bankIds[0] === b.id)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: offer.title,
    description: offer.description,
    discount: offer.discountText,
    seller: {
      '@type': 'Organization',
      name: offer.merchantName,
    },
    ...(offer.validFrom && { validFrom: offer.validFrom }),
    ...(offer.validTo && { validThrough: offer.validTo }),
    ...(bank && {
      offeredBy: {
        '@type': 'BankOrCreditUnion',
        name: bank.name,
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
    description:
      'Find promotions for your Sri Lankan credit and debit cards.',
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

// Suppress unused import warning - formatDate used in other places
void formatDate
