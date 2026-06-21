import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  RefreshCw, ExternalLink, Eye, CheckCircle2, XCircle,
  Copy, Search, Activity, CheckSquare, Square, Minus,
  Trash2,
} from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import AdminModal from '@/components/admin/AdminModal'
import ApproveAsOfferModal from '@/components/admin/ApproveAsOfferModal'
import SearchInput from '@/components/common/SearchInput'
import {
  getAllCandidates,
  updateCandidateStatus,
  bulkUpdateCandidateStatus,
  bulkApproveAsOffers,
  bulkPublishHighConfidence,
} from '@/lib/supabase/queries/candidates'
import { getBanks } from '@/lib/supabase/queries/banks'
import { formatDate } from '@/utils/dateUtils'
import type { Bank, CandidateStatus, ScrapedOfferCandidate } from '@/types'

// ── Filter helpers ────────────────────────────────────────────────────────

type ConfidenceFilter = '' | 'high' | 'medium' | 'low' | 'none'
type DateFilter       = '' | 'active' | 'expired' | 'no-date'

const TODAY = new Date().toISOString().split('T')[0]

function matchesConfidence(c: ScrapedOfferCandidate, f: ConfidenceFilter): boolean {
  if (f === '') return true
  const score = c.confidence_score
  if (f === 'none')   return score === null
  if (score === null) return false
  if (f === 'high')   return score >= 0.8
  if (f === 'medium') return score >= 0.5 && score < 0.8
  if (f === 'low')    return score < 0.5
  return true
}

function matchesDate(c: ScrapedOfferCandidate, f: DateFilter): boolean {
  if (f === '') return true
  const vt = c.detected_valid_to
  if (f === 'no-date') return vt === null
  if (f === 'expired') return vt !== null && vt < TODAY
  if (f === 'active')  return vt === null || vt >= TODAY
  return true
}

/**
 * Pick the bank to pre-select: the one with the most pending candidates,
 * falling back to the bank with the most candidates overall. Only banks in
 * `optionIds` (i.e. banks that exist in the dropdown) are considered.
 */
function computeDefaultBank(
  cands: ScrapedOfferCandidate[],
  optionIds: Set<string>,
): string {
  const pending: Record<string, number> = {}
  const total: Record<string, number> = {}
  for (const c of cands) {
    const bid = c.scrape_source?.bank_id
    if (!bid || !optionIds.has(bid)) continue
    total[bid] = (total[bid] ?? 0) + 1
    if (c.status === 'pending') pending[bid] = (pending[bid] ?? 0) + 1
  }
  const top = (m: Record<string, number>) =>
    Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  return top(pending) || top(total)
}

// ── Status tab config ─────────────────────────────────────────────────────

const STATUS_TABS: Array<{ value: CandidateStatus | 'all'; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'pending',   label: 'Pending' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'duplicate', label: 'Duplicate' },
]

// ── Candidate detail modal ────────────────────────────────────────────────

function CandidateDetailModal({
  candidate,
  onClose,
  onApprove,
  onReject,
  onDuplicate,
  updating,
}: {
  candidate: ScrapedOfferCandidate
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onDuplicate: () => void
  updating: boolean
}) {
  const [showRaw, setShowRaw] = useState(false)
  const isPending = candidate.status === 'pending'

  return (
    <AdminModal
      title="Candidate Details"
      onClose={onClose}
      size="xl"
      footer={
        isPending ? (
          <>
            <button onClick={onClose} className="admin-btn-ghost">Close</button>
            <button onClick={onDuplicate} disabled={updating} className="px-3 py-2 rounded-xl text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50 flex items-center gap-1.5">
              <Copy size={13} /> Duplicate
            </button>
            <button onClick={onReject} disabled={updating} className="px-3 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1.5">
              <XCircle size={13} /> Reject
            </button>
            <button onClick={onApprove} disabled={updating} className="admin-btn-primary flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              {updating ? 'Processing…' : 'Approve as Offer'}
            </button>
          </>
        ) : (
          <button onClick={onClose} className="admin-btn-ghost">Close</button>
        )
      }
    >
      <div className="space-y-4">
        {/* Status + confidence */}
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={candidate.status} />
          {candidate.confidence_score !== null && (
            <span className="text-xs text-muted">
              {Math.round(candidate.confidence_score * 100)}% confidence
            </span>
          )}
          {candidate.scrape_source && (
            <span className="text-xs text-muted">
              Source: <span className="text-content font-medium">{candidate.scrape_source.name}</span>
            </span>
          )}
        </div>

        {candidate.title && (
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Title</p>
            <p className="text-sm font-semibold text-content">{candidate.title}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Merchant',   value: candidate.detected_merchant },
            { label: 'Discount',   value: candidate.detected_discount },
            { label: 'Valid From', value: candidate.detected_valid_from ? formatDate(candidate.detected_valid_from) : null },
            { label: 'Valid To',   value: candidate.detected_valid_to   ? formatDate(candidate.detected_valid_to)   : null },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">{label}</p>
              <p className="text-sm text-content mt-0.5">{value ?? <span className="text-muted italic">Not detected</span>}</p>
            </div>
          ))}
        </div>

        {candidate.description && (
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-muted leading-relaxed">{candidate.description}</p>
          </div>
        )}

        {candidate.raw_text && (
          <div>
            <button
              onClick={() => setShowRaw((p) => !p)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-content transition-colors"
            >
              <Eye size={11} />
              {showRaw ? 'Hide raw text' : 'Show raw text'}
            </button>
            {showRaw && (
              <pre className="mt-2 text-xs text-muted bg-slate-50 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words font-mono">
                {candidate.raw_text}
              </pre>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-4 pt-2 border-t border-border text-xs text-muted">
          <span>Created: {formatDate(candidate.created_at)}</span>
          {candidate.source_url && (
            <a href={candidate.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
              <ExternalLink size={11} /> Source URL
            </a>
          )}
          {candidate.candidate_hash && (
            <span className="font-mono" title="Candidate hash">#{candidate.candidate_hash.slice(0, 12)}…</span>
          )}
        </div>
      </div>
    </AdminModal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminScrapedCandidatesPage() {
  const [candidates, setCandidates] = useState<ScrapedOfferCandidate[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<CandidateStatus | 'all'>('pending')
  const [bankFilter, setBankFilter] = useState('')
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('')
  const [search, setSearch] = useState('')

  const [detailCandidate, setDetailCandidate] = useState<ScrapedOfferCandidate | null>(null)
  const [approveCandidate, setApproveCandidate] = useState<ScrapedOfferCandidate | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    id: string
    action: 'rejected' | 'duplicate'
    title: string
  } | null>(null)

  const [updating, setUpdating] = useState(false)

  // ── Bulk selection ──────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState<{
    action: 'rejected' | 'duplicate' | 'approved' | 'published'
  } | null>(null)
  const [bulkApproveResult, setBulkApproveResult] = useState<{
    approved: number; failed: number
  } | null>(null)
  const [bulkPublishResult, setBulkPublishResult] = useState<{
    published: number; skipped: number; failed: number
  } | null>(null)

  // ── Data loading ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cands, bks] = await Promise.all([
        getAllCandidates('all'),
        getBanks(),
      ])
      setCandidates(cands)
      setBanks(bks)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [statusFilter, bankFilter, confidenceFilter, dateFilter, search])

  // ── Bank options & default selection ──────────────────────────────────────
  // Banks that actually have candidates, named via the active-banks list.
  const bankOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const c of candidates) {
      const bid = c.scrape_source?.bank_id
      if (bid) ids.add(bid)
    }
    return banks
      .filter((b) => ids.has(b.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [candidates, banks])

  // On first data load, default the Bank dropdown to the bank with the most
  // pending candidates (falling back to most candidates overall).
  const defaultApplied = useRef(false)
  useEffect(() => {
    if (defaultApplied.current || bankOptions.length === 0) return
    const optionIds = new Set(bankOptions.map((b) => b.id))
    const def = computeDefaultBank(candidates, optionIds)
    if (def) setBankFilter(def)
    defaultApplied.current = true
  }, [bankOptions, candidates])

  // Changing the bank resets every other filter so the view starts clean.
  function handleBankChange(bankId: string) {
    setBankFilter(bankId)
    setConfidenceFilter('')
    setDateFilter('')
    setSearch('')
    setStatusFilter('pending')
  }

  // ── Filtering ───────────────────────────────────────────────────────────
  // Candidates limited to the selected bank — drives both the table and the
  // status chip counts (which reflect the bank only, not the other filters).
  const bankScoped = useMemo(() => {
    if (!bankFilter) return candidates
    return candidates.filter((c) => c.scrape_source?.bank_id === bankFilter)
  }, [candidates, bankFilter])

  const filtered = useMemo(() => {
    return bankScoped.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!matchesConfidence(c, confidenceFilter)) return false
      if (!matchesDate(c, dateFilter)) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          (c.title ?? '').toLowerCase().includes(q) ||
          (c.detected_merchant ?? '').toLowerCase().includes(q) ||
          (c.detected_discount ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [bankScoped, statusFilter, confidenceFilter, dateFilter, search])

  // Only pending candidates can be bulk-acted on
  const selectableIds = useMemo(
    () => new Set(filtered.filter((c) => c.status === 'pending').map((c) => c.id)),
    [filtered],
  )

  // Status chip counts reflect the selected bank only (per the spec).
  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { all: bankScoped.length }
    for (const c of bankScoped) {
      counts[c.status] = (counts[c.status] ?? 0) + 1
    }
    return counts
  }, [bankScoped])

  // ── Checkbox helpers ────────────────────────────────────────────────────
  const allSelectableChecked =
    selectableIds.size > 0 &&
    Array.from(selectableIds).every((id) => selectedIds.has(id))

  const someSelectableChecked =
    !allSelectableChecked &&
    Array.from(selectableIds).some((id) => selectedIds.has(id))

  function toggleSelectAll() {
    if (allSelectableChecked) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableIds))
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Single-candidate actions ────────────────────────────────────────────
  async function handleStatusAction(id: string, status: 'rejected' | 'duplicate') {
    setUpdating(true)
    try {
      await updateCandidateStatus(id, status)
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
      setDetailCandidate((prev) => prev?.id === id ? { ...prev, status } : prev)
      setConfirmAction(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setUpdating(false)
    }
  }

  function handleApproveFromDetail() {
    if (detailCandidate) {
      setApproveCandidate(detailCandidate)
      setDetailCandidate(null)
    }
  }

  function handleApproved() {
    const id = approveCandidate?.id
    setApproveCandidate(null)
    if (id) {
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'approved' } : c)))
    }
    void load()
  }

  // ── Bulk actions ────────────────────────────────────────────────────────
  async function executeBulkAction(action: 'rejected' | 'duplicate' | 'approved' | 'published') {
    if (selectedIds.size === 0) return
    setBulkUpdating(true)
    setBulkApproveResult(null)
    setBulkPublishResult(null)
    try {
      if (action === 'approved') {
        const toApprove = filtered.filter((c) => selectedIds.has(c.id))
        const result = await bulkApproveAsOffers(toApprove)
        setCandidates((prev) =>
          prev.map((c) => selectedIds.has(c.id) ? { ...c, status: 'approved' } : c),
        )
        setSelectedIds(new Set())
        setConfirmBulk(null)
        setBulkApproveResult(result)
      } else if (action === 'published') {
        const toPublish = filtered.filter((c) => selectedIds.has(c.id))
        const result = await bulkPublishHighConfidence(toPublish)
        setSelectedIds(new Set())
        setConfirmBulk(null)
        setBulkPublishResult(result)
        await load()
      } else {
        const ids = Array.from(selectedIds)
        await bulkUpdateCandidateStatus(ids, action)
        setCandidates((prev) =>
          prev.map((c) => selectedIds.has(c.id) ? { ...c, status: action } : c),
        )
        setSelectedIds(new Set())
        setConfirmBulk(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk update failed')
    } finally {
      setBulkUpdating(false)
    }
  }

  const selectedCount = selectedIds.size

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Scraped Candidates"
        subtitle={`${countByStatus['pending'] ?? 0} pending review`}
        action={
          <div className="flex items-center gap-2">
            <Link to="/admin/scrape-runs" className="admin-btn-ghost flex items-center gap-1.5 text-xs">
              <Activity size={13} /> Scrape Runs
            </Link>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="admin-btn-ghost flex items-center gap-1.5 text-xs"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="admin-error mb-4">
          {error}
          <button onClick={() => void load()} className="ml-1 underline text-xs">Retry</button>
        </div>
      )}

      {/* Bank — primary filter (drives the status chip counts below) */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-content mb-1.5 block">
          Bank
        </label>
        <select
          value={bankFilter}
          onChange={(e) => handleBankChange(e.target.value)}
          className="admin-input sm:max-w-xs"
        >
          <option value="">All banks</option>
          {bankOptions.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Status tabs */}
      <div className="admin-tabs mb-3">
        {STATUS_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === value
                ? 'bg-primary text-white'
                : 'bg-white border border-border text-muted hover:text-content'
            }`}
          >
            {label}
            <span className="ml-1 opacity-70">({countByStatus[value] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, merchant, discount…" />
      </div>

      {/* Filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {/* Confidence */}
        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
          className="admin-input"
        >
          <option value="">All confidence levels</option>
          <option value="high">High — ≥ 80%</option>
          <option value="medium">Medium — 50–79%</option>
          <option value="low">Low — &lt; 50%</option>
          <option value="none">No score</option>
        </select>

        {/* Date status */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="admin-input"
        >
          <option value="">All dates</option>
          <option value="active">Active (not expired)</option>
          <option value="expired">Expired</option>
          <option value="no-date">No date detected</option>
        </select>
      </div>

      {/* Bulk approve result banner */}
      {bulkApproveResult && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-3">
          <span>
            ✓ {bulkApproveResult.approved} offer{bulkApproveResult.approved !== 1 ? 's' : ''} created as drafts
            {bulkApproveResult.failed > 0 && (
              <span className="text-amber-600 ml-2">· {bulkApproveResult.failed} failed</span>
            )}
            {' '}— set bank rules &amp; merchant in the Offers page.
          </span>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <Link to="/admin/offers" className="underline text-xs font-medium">View Offers →</Link>
            <button
              onClick={() => setBulkApproveResult(null)}
              className="text-emerald-500 hover:text-emerald-700 text-xs"
            >✕</button>
          </div>
        </div>
      )}

      {/* Bulk publish result banner */}
      {bulkPublishResult && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-3">
          <span>
            ✓ {bulkPublishResult.published} offer{bulkPublishResult.published !== 1 ? 's' : ''} published live
            {bulkPublishResult.skipped > 0 && (
              <span className="ml-2">· {bulkPublishResult.skipped} skipped (below 80%)</span>
            )}
            {bulkPublishResult.failed > 0 && (
              <span className="text-amber-600 ml-2">· {bulkPublishResult.failed} failed</span>
            )}
          </span>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <Link to="/admin/offers" className="underline text-xs font-medium">View Offers →</Link>
            <button
              onClick={() => setBulkPublishResult(null)}
              className="text-emerald-500 hover:text-emerald-700 text-xs"
            >✕</button>
          </div>
        </div>
      )}

      {/* ── Bulk action bar — visible when rows are selected ── */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 mb-3">
          <span className="text-sm font-semibold text-primary">
            {selectedCount} candidate{selectedCount !== 1 ? 's' : ''} selected
          </span>

          <div className="flex-1" />

          {/* Bulk publish high-confidence */}
          <button
            onClick={() => setConfirmBulk({ action: 'published' })}
            disabled={bulkUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={13} />
            Publish ≥80% as Live
          </button>

          {/* Bulk approve */}
          <button
            onClick={() => setConfirmBulk({ action: 'approved' })}
            disabled={bulkUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={13} />
            Approve {selectedCount} as Drafts
          </button>

          {/* Bulk reject */}
          <button
            onClick={() => setConfirmBulk({ action: 'rejected' })}
            disabled={bulkUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <XCircle size={13} />
            Reject {selectedCount}
          </button>

          {/* Bulk duplicate */}
          <button
            onClick={() => setConfirmBulk({ action: 'duplicate' })}
            disabled={bulkUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-50"
          >
            <Copy size={13} />
            Mark Duplicate ({selectedCount})
          </button>

          {/* Deselect */}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-content hover:bg-slate-100 transition-colors"
          >
            <Trash2 size={12} />
            Deselect
          </button>

          {bulkUpdating && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Search size={24} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-muted">
              {candidates.length === 0
                ? 'No scraped candidates yet. Run the Python scraper to populate this list.'
                : 'No candidates match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {/* Select-all checkbox */}
                  <th className="admin-th w-10 text-center">
                    {selectableIds.size > 0 && (
                      <button
                        onClick={toggleSelectAll}
                        className="w-5 h-5 flex items-center justify-center text-muted hover:text-primary transition-colors mx-auto"
                        title={allSelectableChecked ? 'Deselect all' : 'Select all pending'}
                      >
                        {allSelectableChecked ? (
                          <CheckSquare size={15} className="text-primary" />
                        ) : someSelectableChecked ? (
                          <Minus size={15} className="text-primary" />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                    )}
                  </th>
                  <th className="admin-th">Title</th>
                  <th className="admin-th">Merchant</th>
                  <th className="admin-th">Discount</th>
                  <th className="admin-th">Valid To</th>
                  <th className="admin-th">Conf.</th>
                  <th className="admin-th">Source</th>
                  <th className="admin-th">Status</th>
                  <th className="admin-th">Added</th>
                  <th className="admin-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => {
                  const isSelectable = c.status === 'pending'
                  const isSelected = selectedIds.has(c.id)
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${
                        isSelected ? 'bg-primary/[0.04]' : ''
                      }`}
                      onClick={() => setDetailCandidate(c)}
                    >
                      {/* Row checkbox */}
                      <td
                        className="admin-td text-center w-10"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isSelectable) toggleRow(c.id)
                        }}
                      >
                        {isSelectable && (
                          <button
                            className="w-5 h-5 flex items-center justify-center text-muted hover:text-primary transition-colors mx-auto"
                            tabIndex={-1}
                          >
                            {isSelected
                              ? <CheckSquare size={15} className="text-primary" />
                              : <Square size={15} />
                            }
                          </button>
                        )}
                      </td>

                      <td className="admin-td max-w-[200px]">
                        <p className="line-clamp-1 font-medium">{c.title ?? <span className="text-muted italic">No title</span>}</p>
                      </td>
                      <td className="admin-td text-muted max-w-[120px]">
                        <p className="line-clamp-1">{c.detected_merchant ?? '—'}</p>
                      </td>
                      <td className="admin-td text-muted">
                        {c.detected_discount ?? '—'}
                      </td>
                      <td className="admin-td text-muted text-xs whitespace-nowrap">
                        {c.detected_valid_to ? formatDate(c.detected_valid_to) : '—'}
                      </td>
                      <td className="admin-td text-muted text-xs">
                        {c.confidence_score !== null ? `${Math.round(c.confidence_score * 100)}%` : '—'}
                      </td>
                      <td className="admin-td text-muted text-xs max-w-[100px]">
                        <p className="line-clamp-1">{c.scrape_source?.name ?? '—'}</p>
                      </td>
                      <td className="admin-td">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={c.status} />
                          {c.offer?.status === 'approved' && c.offer.is_active && (
                            <a
                              href={`/offer/${c.offer.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
                              title="View live offer"
                            >
                              Live <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="admin-td text-muted text-xs whitespace-nowrap">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="admin-td text-right" onClick={(e) => e.stopPropagation()}>
                        {c.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setApproveCandidate(c)}
                              className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors"
                              title="Approve as offer"
                            >
                              <CheckCircle2 size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmAction({ id: c.id, action: 'duplicate', title: c.title ?? 'this candidate' })}
                              className="w-7 h-7 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center transition-colors"
                              title="Mark as duplicate"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmAction({ id: c.id, action: 'rejected', title: c.title ?? 'this candidate' })}
                              className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors"
                              title="Reject"
                            >
                              <XCircle size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary row */}
      {filtered.length > 0 && (
        <p className="text-xs text-muted mt-2 text-right">
          {filtered.length} candidate{filtered.length !== 1 ? 's' : ''} shown
          {selectedCount > 0 && ` · ${selectedCount} selected`}
        </p>
      )}

      {/* ── Bulk action confirm dialog ── */}
      <ConfirmDialog
        open={!!confirmBulk}
        title={
          confirmBulk?.action === 'published'
            ? `Publish High-Confidence Candidates as Live Offers`
            : confirmBulk?.action === 'approved'
            ? `Approve ${selectedCount} Candidates as Drafts`
            : confirmBulk?.action === 'rejected'
              ? `Reject ${selectedCount} Candidates`
              : `Mark ${selectedCount} as Duplicate`
        }
        message={
          confirmBulk?.action === 'published'
            ? `This will immediately publish offers from the selected candidates that score 80% or higher confidence — they'll go live on the public site right away. Lower-confidence candidates in your selection are skipped and left pending.`
            : confirmBulk?.action === 'approved'
            ? `This will create ${selectedCount} new offers in "Pending Review" status — nothing is published yet. You can add bank rules, merchant links, and publish each offer from the Offers page.`
            : confirmBulk?.action === 'rejected'
              ? `This will mark all ${selectedCount} selected candidates as rejected. They won't be deleted — you can review them later.`
              : `This will mark all ${selectedCount} selected candidates as duplicates. They won't be deleted.`
        }
        confirmLabel={
          confirmBulk?.action === 'published'
            ? `Publish ≥80% as Live`
            : confirmBulk?.action === 'approved'
            ? `Create ${selectedCount} Draft Offers`
            : confirmBulk?.action === 'rejected'
              ? `Reject ${selectedCount}`
              : `Mark ${selectedCount} Duplicate`
        }
        danger={confirmBulk?.action === 'rejected'}
        loading={bulkUpdating}
        onConfirm={() => confirmBulk && void executeBulkAction(confirmBulk.action)}
        onCancel={() => setConfirmBulk(null)}
      />

      {/* Detail modal */}
      {detailCandidate && (
        <CandidateDetailModal
          candidate={detailCandidate}
          onClose={() => setDetailCandidate(null)}
          onApprove={handleApproveFromDetail}
          onReject={() => setConfirmAction({ id: detailCandidate.id, action: 'rejected', title: detailCandidate.title ?? 'this candidate' })}
          onDuplicate={() => setConfirmAction({ id: detailCandidate.id, action: 'duplicate', title: detailCandidate.title ?? 'this candidate' })}
          updating={updating}
        />
      )}

      {/* Approve-as-offer modal */}
      {approveCandidate && (
        <ApproveAsOfferModal
          candidate={approveCandidate}
          onClose={() => setApproveCandidate(null)}
          onApproved={handleApproved}
        />
      )}

      {/* Single-candidate confirm */}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.action === 'rejected' ? 'Reject Candidate' : 'Mark as Duplicate'}
        message={`Mark "${confirmAction?.title}" as ${confirmAction?.action === 'rejected' ? 'rejected' : 'duplicate'}? The candidate record will not be deleted.`}
        confirmLabel={confirmAction?.action === 'rejected' ? 'Reject' : 'Mark Duplicate'}
        danger={confirmAction?.action === 'rejected'}
        loading={updating}
        onConfirm={() => confirmAction && void handleStatusAction(confirmAction.id, confirmAction.action)}
        onCancel={() => { setConfirmAction(null); setDetailCandidate(null) }}
      />
    </div>
  )
}
