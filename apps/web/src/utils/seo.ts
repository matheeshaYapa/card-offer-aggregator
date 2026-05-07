/**
 * SEO utilities shared across all public pages.
 *
 * SITE_URL is driven by the VITE_APP_BASE_URL environment variable so the
 * same build artefact works on any domain (local dev, staging, production).
 */

export const SITE_URL: string =
  (import.meta.env.VITE_APP_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://cardpromo.lk'

export const SITE_NAME = 'CardPromo LK'

/** Absolute canonical URL for a given pathname, e.g. '/bank/hnb' */
export function canonicalUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

/** Absolute URL for a named OG image asset in /public/. */
export function ogImageUrl(filename: string = 'og-cover.png'): string {
  return `${SITE_URL}/${filename}`
}
