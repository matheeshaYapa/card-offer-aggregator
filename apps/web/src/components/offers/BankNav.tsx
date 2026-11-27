import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Bank } from '@/types'
import { getBankTheme } from '@/utils/bankTheme'

interface BankNavProps {
  banks: Bank[]
  loading?: boolean
  /** Slug of the bank currently being viewed — highlighted in the pills variant. */
  activeSlug?: string
  /** 'tiles' = home grid with offer counts; 'pills' = compact cross-bank nav. */
  variant?: 'tiles' | 'pills'
  /** Live offer count per bank slug (tiles variant). */
  offerCountBySlug?: Record<string, number>
}

export default function BankNav({
  banks,
  loading = false,
  activeSlug,
  variant = 'tiles',
  offerCountBySlug = {},
}: BankNavProps) {
  if (!loading && banks.length === 0) return null

  if (variant === 'pills') {
    return (
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {banks.map((bank) => {
          const theme = getBankTheme(bank.slug)
          const isActive = bank.slug === activeSlug
          const content = (
            <>
              <span className={`w-1.5 h-1.5 rounded-full ${theme.stripe}`} />
              {bank.short_name ?? bank.name}
            </>
          )
          const base = `shrink-0 inline-flex items-center gap-1.5 h-9 rounded-full px-3.5 text-xs font-semibold ${theme.badge}`
          return isActive ? (
            <span key={bank.id} aria-current="page" className={`${base} ring-2 ring-current`}>
              {content}
            </span>
          ) : (
            <Link key={bank.id} to={`/bank/${bank.slug}`} className={`${base} hover:opacity-80 transition-opacity`}>
              {content}
            </Link>
          )
        })}
      </div>
    )
  }

  // ── Tiles ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="text-sm font-bold text-content">Browse by bank</h2>
        <span className="text-xs text-muted hidden sm:block">Tap a bank to see all its offers</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[62px] rounded-[14px] bg-slate-100 animate-pulse" />
            ))
          : banks.map((bank) => {
              const theme = getBankTheme(bank.slug)
              const count = offerCountBySlug[bank.slug] ?? 0
              return (
                <Link
                  key={bank.id}
                  to={`/bank/${bank.slug}`}
                  className={`block rounded-[14px] px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.08)] ${theme.tileBg} ${theme.tileText}`}
                >
                  <span className="text-sm font-bold">{bank.short_name ?? bank.name}</span>
                  <span className="mt-2 flex items-center justify-between">
                    <span className="text-xs opacity-75">
                      {count} offer{count !== 1 ? 's' : ''}
                    </span>
                    <ArrowRight size={14} />
                  </span>
                </Link>
              )
            })}
      </div>
    </div>
  )
}
