export const OFFERS_PER_PAGE = 24

export function offerPagePath(page: number): string {
  return page === 1 ? '/offers' : `/offers/page/${page}`
}
