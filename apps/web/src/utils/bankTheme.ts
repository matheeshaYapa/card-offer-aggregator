/**
 * Per-bank colour themes so each bank's offers are visually distinguishable.
 *
 * `badge` — soft background + readable text for the bank pill.
 * `stripe` — a solid (500-level) colour used for the card's left accent
 *            stripe, the discount pill, and the small bank dot.
 *
 * IMPORTANT: every class string here must appear in full (no interpolation)
 * so Tailwind's JIT compiler includes them in the production build.
 */
export interface BankTheme {
  badge: string
  stripe: string
}

const THEMES: Record<string, BankTheme> = {
  hnb:                  { badge: 'bg-blue-100 text-blue-700',       stripe: 'bg-blue-500' },
  'commercial-bank':    { badge: 'bg-indigo-100 text-indigo-700',   stripe: 'bg-indigo-500' },
  'sampath-bank':       { badge: 'bg-orange-100 text-orange-700',   stripe: 'bg-orange-500' },
  boc:                  { badge: 'bg-amber-100 text-amber-700',     stripe: 'bg-amber-500' },
  'peoples-bank':       { badge: 'bg-red-100 text-red-700',         stripe: 'bg-red-500' },
  'seylan-bank':        { badge: 'bg-rose-100 text-rose-700',       stripe: 'bg-rose-500' },
  'nations-trust-bank': { badge: 'bg-violet-100 text-violet-700',   stripe: 'bg-violet-500' },
  'ndb-bank':           { badge: 'bg-sky-100 text-sky-700',         stripe: 'bg-sky-500' },
  'amana-bank':         { badge: 'bg-emerald-100 text-emerald-700', stripe: 'bg-emerald-500' },
  'standard-chartered': { badge: 'bg-teal-100 text-teal-700',       stripe: 'bg-teal-500' },
  'union-bank':         { badge: 'bg-fuchsia-100 text-fuchsia-700', stripe: 'bg-fuchsia-500' },
}

/** Deterministic fallback palette for banks without an explicit theme. */
const FALLBACK: BankTheme[] = [
  { badge: 'bg-cyan-100 text-cyan-700',       stripe: 'bg-cyan-500' },
  { badge: 'bg-lime-100 text-lime-700',       stripe: 'bg-lime-500' },
  { badge: 'bg-pink-100 text-pink-700',       stripe: 'bg-pink-500' },
  { badge: 'bg-purple-100 text-purple-700',   stripe: 'bg-purple-500' },
  { badge: 'bg-yellow-100 text-yellow-700',   stripe: 'bg-yellow-500' },
]

const NEUTRAL: BankTheme = { badge: 'bg-slate-100 text-slate-700', stripe: 'bg-slate-400' }

function hash(slug: string): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Return the colour theme for a bank slug (neutral grey when slug is absent). */
export function getBankTheme(slug?: string | null): BankTheme {
  if (!slug) return NEUTRAL
  return THEMES[slug] ?? FALLBACK[hash(slug) % FALLBACK.length]
}
