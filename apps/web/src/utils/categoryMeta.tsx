import {
  BedDouble, Car, Globe, GraduationCap, HeartPulse, LayoutGrid, Receipt, ShoppingBag,
  ShoppingCart, Smartphone, Sparkles, UtensilsCrossed, type LucideIcon,
} from 'lucide-react'

interface CategoryMeta {
  icon: LucideIcon
  /** Tile background + icon colour (full Tailwind class strings so JIT keeps them). */
  tile: string
  iconColor: string
}

const META: Record<string, CategoryMeta> = {
  dining:      { icon: UtensilsCrossed, tile: 'bg-orange-50 hover:bg-orange-100/80', iconColor: 'text-orange-600 bg-orange-100' },
  travel:      { icon: BedDouble,       tile: 'bg-sky-50 hover:bg-sky-100/80',       iconColor: 'text-sky-700 bg-sky-100' },
  supermarket: { icon: ShoppingCart,    tile: 'bg-lime-50 hover:bg-lime-100/80',     iconColor: 'text-lime-700 bg-lime-100' },
  electronics: { icon: Smartphone,      tile: 'bg-indigo-50 hover:bg-indigo-100/80', iconColor: 'text-indigo-600 bg-indigo-100' },
  shopping:    { icon: ShoppingBag,     tile: 'bg-pink-50 hover:bg-pink-100/80',     iconColor: 'text-pink-600 bg-pink-100' },
  online:      { icon: Globe,           tile: 'bg-cyan-50 hover:bg-cyan-100/80',     iconColor: 'text-cyan-700 bg-cyan-100' },
  healthcare:  { icon: HeartPulse,      tile: 'bg-rose-50 hover:bg-rose-100/80',     iconColor: 'text-rose-600 bg-rose-100' },
  lifestyle:   { icon: Sparkles,        tile: 'bg-violet-50 hover:bg-violet-100/80', iconColor: 'text-violet-600 bg-violet-100' },
  automotive:  { icon: Car,             tile: 'bg-slate-100 hover:bg-slate-200/70',  iconColor: 'text-slate-700 bg-slate-200' },
  education:   { icon: GraduationCap,   tile: 'bg-amber-50 hover:bg-amber-100/80',   iconColor: 'text-amber-700 bg-amber-100' },
  services:    { icon: Receipt,         tile: 'bg-teal-50 hover:bg-teal-100/80',     iconColor: 'text-teal-700 bg-teal-100' },
}

const FALLBACK: CategoryMeta = { icon: LayoutGrid, tile: 'bg-emerald-50 hover:bg-emerald-100/80', iconColor: 'text-emerald-700 bg-emerald-100' }

export function getCategoryMeta(slug: string | null | undefined): CategoryMeta {
  return (slug && META[slug]) || FALLBACK
}
