import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import type { Bank } from '@/types'
import { getBankTheme } from '@/utils/bankTheme'

interface BankNavProps {
  banks: Bank[]
  loading?: boolean
  /** Slug of the bank currently being viewed — rendered as a highlighted, non-link chip. */
  activeSlug?: string
}

/**
 * Horizontal "Browse by bank" strip on the dashboard. Each chip links to the
 * bank's dedicated page (`/bank/:slug`) so users can discover and browse a
 * single bank's offers. Renders fixed-height skeleton chips while banks load
 * so its appearance doesn't introduce a layout shift.
 */
export default function BankNav({ banks, loading = false, activeSlug }: BankNavProps) {
  if (!loading && banks.length === 0) return null

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2">
        <Building2 size={13} className="text-muted" />
        <h2 className="text-xs font-semibold text-content">Browse by bank</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 h-8 w-24 rounded-full bg-slate-100 animate-pulse"
              />
            ))
          : banks.map((bank) => {
              const theme = getBankTheme(bank.slug)
              const isActive = bank.slug === activeSlug
              const content = (
                <>
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.stripe}`} />
                  {bank.short_name ?? bank.name}
                </>
              )
              const base = `shrink-0 inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-xs font-semibold ${theme.badge}`

              return isActive ? (
                <span
                  key={bank.id}
                  aria-current="page"
                  className={`${base} ring-2 ring-current ring-offset-1`}
                >
                  {content}
                </span>
              ) : (
                <Link
                  key={bank.id}
                  to={`/bank/${bank.slug}`}
                  className={`${base} hover:opacity-80 transition-opacity`}
                >
                  {content}
                </Link>
              )
            })}
      </div>
    </div>
  )
}
