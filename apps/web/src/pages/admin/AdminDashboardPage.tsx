import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, Building2, CreditCard, Tag, Store, Inbox,
  AlertCircle, Plus, ArrowRight,
} from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { supabase } from '@/lib/supabase/client'

interface Counts {
  offers: number
  banks: number
  cards: number
  categories: number
  merchants: number
  pending_candidates: number
}

const QUICK_LINKS = [
  { to: '/admin/offers/new',    label: 'New Offer',       icon: Plus,       color: 'bg-primary/10 text-primary' },
  { to: '/admin/scraped-candidates', label: 'Review Candidates', icon: Inbox, color: 'bg-amber-100 text-amber-600' },
  { to: '/admin/banks',         label: 'Manage Banks',    icon: Building2,  color: 'bg-blue-100 text-blue-600' },
  { to: '/admin/cards',         label: 'Manage Cards',    icon: CreditCard, color: 'bg-purple-100 text-purple-600' },
  { to: '/admin/categories',    label: 'Categories',      icon: Tag,        color: 'bg-green-100 text-green-600' },
  { to: '/admin/merchants',     label: 'Merchants',       icon: Store,      color: 'bg-orange-100 text-orange-600' },
] as const

export default function AdminDashboardPage() {
  const { session } = useAdminAuth()
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => {
    async function loadCounts() {
      try {
        const [offers, banks, cards, cats, merchants, candidates] = await Promise.all([
          supabase.from('offers').select('id', { count: 'exact', head: true }),
          supabase.from('banks').select('id', { count: 'exact', head: true }),
          supabase.from('cards').select('id', { count: 'exact', head: true }),
          supabase.from('categories').select('id', { count: 'exact', head: true }),
          supabase.from('merchants').select('id', { count: 'exact', head: true }),
          supabase.from('scraped_offer_candidates').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ])
        setCounts({
          offers: offers.count ?? 0,
          banks: banks.count ?? 0,
          cards: cards.count ?? 0,
          categories: cats.count ?? 0,
          merchants: merchants.count ?? 0,
          pending_candidates: candidates.count ?? 0,
        })
      } catch {
        // counts are non-critical
      }
    }
    void loadCounts()
  }, [])

  const statCards = [
    { label: 'Offers',     value: counts?.offers,     icon: FileText,  to: '/admin/offers' },
    { label: 'Banks',      value: counts?.banks,      icon: Building2, to: '/admin/banks' },
    { label: 'Cards',      value: counts?.cards,      icon: CreditCard,to: '/admin/cards' },
    { label: 'Merchants',  value: counts?.merchants,  icon: Store,     to: '/admin/merchants' },
  ]

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-content">Dashboard</h1>
        <p className="text-sm text-muted mt-0.5">
          Welcome back{session?.user.email ? `, ${session.user.email}` : ''}.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map(({ label, value, icon: Icon, to }) => (
          <Link
            key={label}
            to={to}
            className="bg-white border border-border rounded-2xl p-4 hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon size={16} className="text-muted" />
              <ArrowRight size={12} className="text-muted/50" />
            </div>
            <p className="text-2xl font-bold text-content">
              {value !== undefined ? value : <span className="text-slate-200">—</span>}
            </p>
            <p className="text-xs text-muted mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Pending candidates alert */}
      {counts && counts.pending_candidates > 0 && (
        <Link
          to="/admin/scraped-candidates"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 hover:bg-amber-100 transition-colors"
        >
          <Inbox size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <span className="font-semibold">{counts.pending_candidates} scraped candidate{counts.pending_candidates !== 1 ? 's' : ''}</span> awaiting review.
          </p>
          <span className="text-xs text-amber-700 font-medium">Review →</span>
        </Link>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {QUICK_LINKS.map(({ to, label, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 bg-white border border-border rounded-2xl px-4 py-3 hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={15} />
            </div>
            <span className="text-sm font-medium text-content">{label}</span>
          </Link>
        ))}
      </div>

      {/* Setup checklist */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Setup checklist</p>
          <ul className="space-y-0.5 text-xs">
            <li>• Run Supabase migrations 001 → 002 → 003 in the SQL editor</li>
            <li>• Add production domain to Supabase Auth redirect URLs</li>
            <li>• Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in GitHub Actions secrets</li>
            <li>• Run <code className="font-mono bg-amber-100 px-1 rounded">npm run generate:icons</code> to create PWA PNG icons</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
