/**
 * Columns + joins for a public offer. Shared by the app's Supabase queries and
 * the build-time snapshot (scripts/snapshot.ts), so both see the same shape.
 * Kept free of imports so Node build scripts can use it.
 */
export const OFFER_SELECT = `
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
