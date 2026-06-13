import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, Building2, CreditCard, Tag, Store, Inbox,
  AlertCircle, Plus, ArrowRight, Trash2, RefreshCw,
} from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { supabase } from '@/lib/supabase/client'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import {
  CLEANUP_DAYS,
  getExpiredCleanupCounts,
  cleanupExpired,
  type CleanupCounts,
} from '@/lib/supabase/queries/admin-cleanup'

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

  // ── Maintenance / cleanup state ──
  const [cleanupCounts, setCleanupCounts] = useState<CleanupCounts | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [confirmCleanup, setConfirmCleanup] = useState(false)
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<CleanupCounts | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)

  const loadCleanupCounts = useCallback(async () => {
    setCleanupLoading(true)
    setCleanupError(null)
    try {
      setCleanupCounts(await getExpiredCleanupCounts())
    } catch (e) {
      setCleanupError(e instanceof Error ? e.message : 'Failed to load cleanup counts')
    } finally {
      setCleanupLoading(false)
    }
  }, [])

  async function handleCleanup() {
    setCleanupRunning(true)
    setCleanupError(null)
    try {
      const result = await cleanupExpired()
      setCleanupResult(result)
      setConfirmCleanup(false)
      await loadCleanupCounts()
      // Refresh dashboard counts too — offers count probably changed
      void (async () => {
        try {
          const offers = await supabase.from('offers').select('id', { count: 'exact', head: true })
          setCounts((prev) => prev ? { ...prev, offers: offers.count ?? prev.offers } : prev)
        } catch { /* non-critical */ }
      })()
    } catch (e) {
      setCleanupError(e instanceof Error ? e.message : 'Cleanup failed')
    } finally {
      setCleanupRunning(false)
    }
  }

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
    void loadCleanupCounts()
  }, [loadCleanupCounts])

  const statCards = [
    { label: 'Offers',     value: counts?.offers,     icon: FileText,  to: '/admin/offers' },
    { label: 'Banks',      value: counts?.banks,      icon: Building2, to: '/admin/banks' },
    { label: 'Cards',      value: counts?.cards,      icon: CreditCard,to: '/admin/cards' },
    { label: 'Merchants',  value: counts?.merchants,  icon: Store,     to: '/admin/merchants' },
  ]

  return (
    <div className="admin-page max-w-4xl">
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

      {/* Maintenance — expired data cleanup */}
      <div className="bg-white border border-border rounded-2xl p-4 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <Trash2 size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-content">Maintenance</h2>
            <p className="text-xs text-muted mt-0.5">
              Permanently delete offers and scraped candidates that expired more
              than {CLEANUP_DAYS} days ago.
            </p>
          </div>
          <button
            onClick={() => void loadCleanupCounts()}
            disabled={cleanupLoading}
            className="admin-icon-btn shrink-0"
            title="Refresh counts"
          >
            <RefreshCw size={13} className={cleanupLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {cleanupError && (
          <div className="admin-error mb-3 text-xs">{cleanupError}</div>
        )}

        {cleanupResult && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-3 flex items-center justify-between">
            <span>
              ✓ Deleted {cleanupResult.offers} offer{cleanupResult.offers !== 1 ? 's' : ''} and{' '}
              {cleanupResult.candidates} candidate{cleanupResult.candidates !== 1 ? 's' : ''}.
            </span>
            <button
              onClick={() => setCleanupResult(null)}
              className="text-emerald-500 hover:text-emerald-700"
            >✕</button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted">
            {cleanupCounts ? (
              cleanupCounts.offers === 0 && cleanupCounts.candidates === 0 ? (
                <span>Nothing to delete — no records are more than {CLEANUP_DAYS} days past expiry.</span>
              ) : (
                <>
                  <span className="font-semibold text-content">{cleanupCounts.offers}</span> offer{cleanupCounts.offers !== 1 ? 's' : ''}
                  {' · '}
                  <span className="font-semibold text-content">{cleanupCounts.candidates}</span> candidate{cleanupCounts.candidates !== 1 ? 's' : ''}
                  {' '}eligible for cleanup.
                </>
              )
            ) : (
              <span className="text-slate-300">Loading…</span>
            )}
          </div>
          <button
            onClick={() => setConfirmCleanup(true)}
            disabled={
              cleanupLoading ||
              cleanupRunning ||
              !cleanupCounts ||
              (cleanupCounts.offers === 0 && cleanupCounts.candidates === 0)
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            Clean Up Now
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCleanup}
        title="Permanently Delete Expired Records"
        message={
          cleanupCounts
            ? `This will permanently delete ${cleanupCounts.offers} offer${cleanupCounts.offers !== 1 ? 's' : ''} and ${cleanupCounts.candidates} candidate${cleanupCounts.candidates !== 1 ? 's' : ''} that expired more than ${CLEANUP_DAYS} days ago. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        loading={cleanupRunning}
        onConfirm={() => void handleCleanup()}
        onCancel={() => setConfirmCleanup(false)}
      />

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
