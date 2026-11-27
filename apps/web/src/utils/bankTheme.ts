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
  /** Soft pill: background + text, e.g. `bg-blue-100 text-blue-700`. */
  badge: string
  /** Solid accent for stripes/dots, e.g. `bg-blue-500`. */
  stripe: string
  /** Text colour matching the stripe hue, for the deal-first discount number. */
  accent: string
  /** Soft tint background alone (bank tiles / heroes), e.g. `bg-blue-100`. */
  tileBg: string
  /** Readable text colour on the soft tint, e.g. `text-blue-700`. */
  tileText: string
}

const THEMES: Record<string, BankTheme> = {
  hnb:                  { badge: 'bg-blue-100 text-blue-700',       stripe: 'bg-blue-500',    accent: 'text-blue-600',    tileBg: 'bg-blue-100',    tileText: 'text-blue-700' },
  'commercial-bank':    { badge: 'bg-indigo-100 text-indigo-700',   stripe: 'bg-indigo-500',  accent: 'text-indigo-600',  tileBg: 'bg-indigo-100',  tileText: 'text-indigo-700' },
  'sampath-bank':       { badge: 'bg-orange-100 text-orange-700',   stripe: 'bg-orange-500',  accent: 'text-orange-600',  tileBg: 'bg-orange-100',  tileText: 'text-orange-700' },
  boc:                  { badge: 'bg-amber-100 text-amber-700',     stripe: 'bg-amber-500',   accent: 'text-amber-600',   tileBg: 'bg-amber-100',   tileText: 'text-amber-700' },
  'dfcc-bank':          { badge: 'bg-cyan-100 text-cyan-700',       stripe: 'bg-cyan-600',    accent: 'text-cyan-700',    tileBg: 'bg-cyan-100',    tileText: 'text-cyan-700' },
  'peoples-bank':       { badge: 'bg-red-100 text-red-700',         stripe: 'bg-red-500',     accent: 'text-red-600',     tileBg: 'bg-red-100',     tileText: 'text-red-700' },
  'seylan-bank':        { badge: 'bg-rose-100 text-rose-700',       stripe: 'bg-rose-500',    accent: 'text-rose-600',    tileBg: 'bg-rose-100',    tileText: 'text-rose-700' },
  'nations-trust-bank': { badge: 'bg-violet-100 text-violet-700',   stripe: 'bg-violet-500',  accent: 'text-violet-600',  tileBg: 'bg-violet-100',  tileText: 'text-violet-700' },
  'ndb-bank':           { badge: 'bg-sky-100 text-sky-700',         stripe: 'bg-sky-500',     accent: 'text-sky-600',     tileBg: 'bg-sky-100',     tileText: 'text-sky-700' },
  'amana-bank':         { badge: 'bg-emerald-100 text-emerald-700', stripe: 'bg-emerald-500', accent: 'text-emerald-600', tileBg: 'bg-emerald-100', tileText: 'text-emerald-700' },
  'standard-chartered': { badge: 'bg-teal-100 text-teal-700',       stripe: 'bg-teal-500',    accent: 'text-teal-600',    tileBg: 'bg-teal-100',    tileText: 'text-teal-700' },
  'union-bank':         { badge: 'bg-fuchsia-100 text-fuchsia-700', stripe: 'bg-fuchsia-500', accent: 'text-fuchsia-600', tileBg: 'bg-fuchsia-100', tileText: 'text-fuchsia-700' },
}

/** Deterministic fallback palette for banks without an explicit theme. */
const FALLBACK: BankTheme[] = [
  { badge: 'bg-cyan-100 text-cyan-700',     stripe: 'bg-cyan-500',   accent: 'text-cyan-600',   tileBg: 'bg-cyan-100',   tileText: 'text-cyan-700' },
  { badge: 'bg-lime-100 text-lime-700',     stripe: 'bg-lime-500',   accent: 'text-lime-600',   tileBg: 'bg-lime-100',   tileText: 'text-lime-700' },
  { badge: 'bg-pink-100 text-pink-700',     stripe: 'bg-pink-500',   accent: 'text-pink-600',   tileBg: 'bg-pink-100',   tileText: 'text-pink-700' },
  { badge: 'bg-purple-100 text-purple-700', stripe: 'bg-purple-500', accent: 'text-purple-600', tileBg: 'bg-purple-100', tileText: 'text-purple-700' },
  { badge: 'bg-yellow-100 text-yellow-700', stripe: 'bg-yellow-500', accent: 'text-yellow-600', tileBg: 'bg-yellow-100', tileText: 'text-yellow-700' },
]

const NEUTRAL: BankTheme = {
  badge: 'bg-slate-100 text-slate-700', stripe: 'bg-slate-400',
  accent: 'text-slate-600', tileBg: 'bg-slate-100', tileText: 'text-slate-700',
}

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
