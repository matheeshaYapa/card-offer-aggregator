import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  RefreshCw, ExternalLink, Eye, CheckCircle2, XCircle,
  Copy, Search, Activity,
} from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import AdminModal from '@/components/admin/AdminModal'
import ApproveAsOfferModal from '@/components/admin/ApproveAsOfferModal'
import SearchInput from '@/components/common/SearchInput'
import { getAllCandidates, updateCandidateStatus } from '@/lib/supabase/queries/candidates'
import { getScrapeSourcesAdmin } from '@/lib/supabase/queries/admin-scrape'
import { formatDate } from '@/utils/dateUtils'
import type { CandidateStatus, ScrapedOfferCandidate, ScrapeSource } from '@/types'

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
        <div className="flex items-center gap-3">
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

        {/* Title */}
        {candidate.title && (
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Title</p>
            <p className="text-sm font-semibold text-content">{candidate.title}</p>
          </div>
        )}

        {/* Detected fields grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Merchant',    value: candidate.detected_merchant },
            { label: 'Discount',    value: candidate.detected_discount },
            { label: 'Valid From',  value: candidate.detected_valid_from ? formatDate(candidate.detected_valid_from) : null },
            { label: 'Valid To',    value: candidate.detected_valid_to   ? formatDate(candidate.detected_valid_to)   : null },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">{label}</p>
              <p className="text-sm text-content mt-0.5">{value ?? <span className="text-muted italic">Not detected</span>}</p>
            </div>
          ))}
        </div>

        {/* Description */}
        {candidate.description && (
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-muted leading-relaxed">{candidate.description}</p>
          </div>
        )}

        {/* Raw text (collapsible) */}
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

        {/* Meta */}
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
  const [sources, setSources] = useState<ScrapeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<CandidateStatus | 'all'>('pending')
  const [sourceFilter, setSourceFilter] = useState('')
  const [search, setSearch] = useState('')

  const [detailCandidate, setDetailCandidate] = useState<ScrapedOfferCandidate | null>(null)
  const [approveCandidate, setApproveCandidate] = useState<ScrapedOfferCandidate | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    id: string
    action: 'rejected' | 'duplicate'
    title: string
  } | null>(null)

  const [updating, setUpdating] = useState(false)

  // ── Data loading ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cands, srcs] = await Promise.all([
        getAllCandidates('all'),
        getScrapeSourcesAdmin(),
      ])
      setCandidates(cands)
      setSources(srcs)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Filtering ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (sourceFilter && c.scrape_source_id !== sourceFilter) return false
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
  }, [candidates, statusFilter, sourceFilter, search])

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { all: candidates.length }
    for (const c of candidates) {
      counts[c.status] = (counts[c.status] ?? 0) + 1
    }
    return counts
  }, [candidates])

  // ── Actions ─────────────────────────────────────────────────────────────
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

  function handleApproved(offerId: string) {
    const id = approveCandidate?.id
    setApproveCandidate(null)
    if (id) {
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'approved' } : c)))
    }
    // Flash success: navigate to the new offer
    window.open(`/admin/offers`, '_blank')
    void load()
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
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

      {error && <div className="admin-error mb-4">{error} <button onClick={() => void load()} className="ml-1 underline text-xs">Retry</button></div>}

      {/* Status tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
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

      {/* Search + source filter */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search title, merchant, discount…" />
        </div>
        {sources.length > 0 && (
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="admin-input w-48"
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

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
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
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
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    onClick={() => setDetailCandidate(c)}
                  >
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
                      <StatusBadge status={c.status} />
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      {/* Confirm reject / duplicate */}
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
