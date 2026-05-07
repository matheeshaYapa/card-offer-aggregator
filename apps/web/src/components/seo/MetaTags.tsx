import { Helmet } from 'react-helmet-async'
import { SITE_NAME, SITE_URL, ogImageUrl } from '@/utils/seo'

interface MetaTagsProps {
  title: string
  description: string
  /** Absolute canonical URL for this page. Always pass this — it's used for og:url too. */
  canonical?: string
  /** Override the Open Graph share image (absolute URL to a PNG/JPG). */
  ogImage?: string
  /** Open Graph type. Defaults to 'website'; use 'article' for offer detail pages. */
  ogType?: string
  /** Set true to prevent search-engine indexing (error states, 404s, /my-cards). */
  noIndex?: boolean
}

/** Default OG share image — 1200×630 PNG placed in public/. */
const DEFAULT_OG_IMAGE = ogImageUrl('og-cover.png')

export default function MetaTags({
  title,
  description,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  noIndex = false,
}: MetaTagsProps) {
  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`

  // Resolve canonical — fall back to site root so there's always an og:url
  const resolvedCanonical = canonical ?? SITE_URL

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={resolvedCanonical} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_LK" />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  )
}
