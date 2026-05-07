/** Generate a URL-safe slug from any string */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Generate a slug for an offer: "{bank-slug}-{discount}-{merchant-slug}" */
export function generateOfferSlug(
  bankSlug: string,
  discountText: string,
  merchantSlug: string,
): string {
  return `${slugify(bankSlug)}-${slugify(discountText)}-${slugify(merchantSlug)}`
    .slice(0, 100)
}
