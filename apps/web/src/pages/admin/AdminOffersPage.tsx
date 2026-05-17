import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Pencil, ToggleLeft, ToggleRight, ExternalLink, RefreshCw,
  CheckSquare, Square, Minus,
} from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { getAllOffersAdmin, toggleOfferActive, updateOfferStatus, bulkUpdateOfferStatus } from '@/lib/supabase/queries/offers'
import { formatDate } from '@/utils/dateUtils'
import type { Offer, OfferStatus } from '@/types'

const STATUS_TABS: Array<{ value: OfferStatus | 'all'; label: string }> = [
  { value: 'all',            label: 'All' },
  { value: 'approved',       label: 'Approved' },
  { value: 'draft',          label: 'Draft' },
  { value: 'pending_review', label: 'Pending' },
  { value: 'rejected',       label: 'Rejected' },
  { value: 'expired',        label: 'Expired' },
]

const BULK_STATUS_OPTIONS: Array<{ value: OfferStatus; label: string }> = [
  { value: 'approved',       label: 'Approved (publish)' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'draft',          label: 'Draft' },
  { value: 'rejected',       label: 'Rejected' },
  { value: 'expired',        label: 'Expired' },
]

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OfferStatus | 'all'>('all')

  // Single-offer actions
  const [confirmToggle, setConfirmToggle] = useState<Offer | null>(null)
  const [toggling, setToggling] = useState(false)
  const [quickStatus, setQuickStatus] = useState<{ offer: Offer; status: OfferStatus } | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkTargetStatus, setBulkTargetStatus] = useState<OfferStatus>('approved')
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setOffers(await getAllOffersAdmin()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  // Clear selection when tab changes
  useEffect(() => { setSelectedIds(new Set()) }, [statusFilter])

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(
    () => statusFilter === 'all' ? offers : offers.filter((o) => o.status === statusFilter),
    [offers, statusFilter],
  )

  // ── Checkbox helpers ──────────────────────────────────────────────────────
  const allChecked =
    filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id))
  const someChecked =
    !allChecked && filtered.some((o) => selectedIds.has(o.id))

  function toggleSelectAll() {
    if (allChecked) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((o) => o.id)))
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedCount = selectedIds.size

  // ── Single-offer actions ──────────────────────────────────────────────────
  async function handleToggle() {
    if (!confirmToggle) return
    setToggling(true)
    try {
      await toggleOfferActive(confirmToggle.id, !confirmToggle.is_active)
      setConfirmToggle(null); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setToggling(false) }
  }

  async function handleQuickStatus() {
    if (!quickStatus) return
    setUpdatingStatus(true)
    try {
      await updateOfferStatus(quickStatus.offer.id, quickStatus.status)
      setQuickStatus(null); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setUpdatingStatus(false) }
  }

  // ── Bulk status change ────────────────────────────────────────────────────
  async function executeBulkStatus() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkUpdating(true)
    try {
      await bulkUpdateOfferStatus(ids, bulkTargetStatus)
      setOffers((prev) =>
        prev.map((o) =>
          selectedIds.has(o.id)
            ? {
                ...o,
                status: bulkTargetStatus,
                published_at:
                  bulkTargetStatus === 'approved'
                    ? (o.published_at ?? new Date().toISOString())
                    : o.published_at,
              }
            : o,
        ),
      )
      setSelectedIds(new Set())
      setConfirmBulk(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk update failed')
    } finally {
      setBulkUpdating(false)
    }
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Offers"
        subtitle={`${offers.length} total`}
        action={
          <Link to="/admin/offers/new" className="admin-btn-primary flex items-center gap-1.5">
            <Plus size={14} /> New Offer
          </Link>
        }
      />

      {error && (
        <div className="admin-error mb-4">
          {error}
          <button onClick={() => void load()} className="ml-1 underline text-xs">Retry</button>
        </div>
      )}

      {/* Status tabs */}
      <div className="admin-tabs mb-4">
        {STATUS_TABS.map(({ value, label }) => {
          const count = value === 'all' ? offers.length : offers.filter((o) => o.status === value).length
          return (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-primary text-white'
                  : 'bg-white border border-border text-muted hover:text-content'
              }`}
            >
              {label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
        <button
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-content border border-border ml-auto"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 mb-3">
          <span className="text-sm font-semibold text-primary">
            {selectedCount} offer{selectedCount !== 1 ? 's' : ''} selected
          </span>

          <div className="flex-1" />

          <span className="text-xs text-muted shrink-0">Set status to</span>
          <select
            value={bulkTargetStatus}
            onChange={(e) => setBulkTargetStatus(e.target.value as OfferStatus)}
            className="admin-input w-auto text-xs py-1.5"
          >
            {BULK_STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <button
            onClick={() => setConfirmBulk(true)}
            disabled={bulkUpdating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            Apply to {selectedCount}
          </button>

          <button
            onClick={() => setSelectedIds(new Set())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-content hover:bg-slate-100 transition-colors"
          >
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
          <p className="text-sm text-muted text-center py-16">No offers in this status.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[740px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {/* Select-all */}
                  <th className="admin-th w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="w-5 h-5 flex items-center justify-center text-muted hover:text-primary transition-colors mx-auto"
                      title={allChecked ? 'Deselect all' : 'Select all'}
                    >
                      {allChecked ? (
                        <CheckSquare size={15} className="text-primary" />
                      ) : someChecked ? (
                        <Minus size={15} className="text-primary" />
                      ) : (
                        <Square size={15} />
                      )}
                    </button>
                  </th>
                  <th className="admin-th">Title</th>
                  <th className="admin-th">Bank(s)</th>
                  <th className="admin-th">Discount</th>
                  <th className="admin-th">Status</th>
                  <th className="admin-th">Valid To</th>
                  <th className="admin-th">Active</th>
                  <th className="admin-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((offer) => {
                  const banks = Array.from(
                    new Map(
                      (offer.offer_bank_rules ?? [])
                        .filter((r) => r.bank)
                        .map((r) => [r.bank!.id, r.bank!]),
                    ).values(),
                  )
                  const isSelected = selectedIds.has(offer.id)
                  return (
                    <tr
                      key={offer.id}
                      className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-primary/[0.04]' : ''}`}
                    >
                      {/* Row checkbox */}
                      <td
                        className="admin-td text-center w-10"
                        onClick={() => toggleRow(offer.id)}
                      >
                        <button className="w-5 h-5 flex items-center justify-center text-muted hover:text-primary transition-colors mx-auto">
                          {isSelected
                            ? <CheckSquare size={15} className="text-primary" />
                            : <Square size={15} />
                          }
                        </button>
                      </td>

                      <td className="admin-td max-w-[200px]">
                        <div>
                          <p className="font-medium text-content line-clamp-1">{offer.title}</p>
                          {offer.is_featured && (
                            <span className="text-[10px] text-amber-600 font-medium">⭐ Featured</span>
                          )}
                        </div>
                      </td>
                      <td className="admin-td text-muted text-xs">
                        {banks.length > 0
                          ? <>
                              {banks.slice(0, 2).map((b) => b.short_name ?? b.name).join(', ')}
                              {banks.length > 2 && ` +${banks.length - 2}`}
                            </>
                          : <span className="italic">—</span>
                        }
                      </td>
                      <td className="admin-td text-muted">{offer.discount_text ?? '—'}</td>
                      <td className="admin-td">
                        <select
                          value={offer.status}
                          onChange={(e) =>
                            setQuickStatus({ offer, status: e.target.value as OfferStatus })
                          }
                          className="text-xs border-0 bg-transparent p-0 cursor-pointer focus:outline-none"
                        >
                          {(
                            ['draft', 'pending_review', 'approved', 'rejected', 'expired'] as OfferStatus[]
                          ).map((s) => (
                            <option key={s} value={s}>
                              {s.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="admin-td text-muted text-xs">
                        {offer.valid_to ? formatDate(offer.valid_to) : '—'}
                      </td>
                      <td className="admin-td">
                        <StatusBadge status={offer.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="admin-td text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/admin/offers/${offer.id}/edit`}
                            className="admin-icon-btn"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </Link>
                          <button
                            onClick={() => setConfirmToggle(offer)}
                            className="admin-icon-btn"
                            title={offer.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {offer.is_active
                              ? <ToggleLeft size={15} />
                              : <ToggleRight size={15} className="text-primary" />
                            }
                          </button>
                          {offer.status === 'approved' && (
                            <a
                              href={`/offer/${offer.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="admin-icon-btn"
                              title="View public page"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row count */}
      {filtered.length > 0 && (
        <p className="text-xs text-muted mt-2 text-right">
          {filtered.length} offer{filtered.length !== 1 ? 's' : ''} shown
          {selectedCount > 0 && ` · ${selectedCount} selected`}
        </p>
      )}

      {/* Confirm active toggle */}
      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.is_active ? 'Deactivate Offer' : 'Activate Offer'}
        message={`${confirmToggle?.is_active ? 'Deactivate' : 'Activate'} "${confirmToggle?.title}"?`}
        confirmLabel={confirmToggle?.is_active ? 'Deactivate' : 'Activate'}
        danger={confirmToggle?.is_active}
        loading={toggling}
        onConfirm={() => void handleToggle()}
        onCancel={() => setConfirmToggle(null)}
      />

      {/* Confirm single status change */}
      <ConfirmDialog
        open={!!quickStatus}
        title="Change Status"
        message={`Change "${quickStatus?.offer.title}" status to "${quickStatus?.status.replace('_', ' ')}"?`}
        confirmLabel="Update"
        loading={updatingStatus}
        onConfirm={() => void handleQuickStatus()}
        onCancel={() => setQuickStatus(null)}
      />

      {/* Confirm bulk status change */}
      <ConfirmDialog
        open={confirmBulk}
        title={`Set ${selectedCount} Offers to "${bulkTargetStatus.replace('_', ' ')}"`}
        message={
          bulkTargetStatus === 'approved'
            ? `This will publish ${selectedCount} offer${selectedCount !== 1 ? 's' : ''} immediately and make them visible to the public.`
            : `This will change the status of ${selectedCount} offer${selectedCount !== 1 ? 's' : ''} to "${bulkTargetStatus.replace('_', ' ')}".`
        }
        confirmLabel={`Update ${selectedCount} Offers`}
        danger={bulkTargetStatus === 'rejected' || bulkTargetStatus === 'expired'}
        loading={bulkUpdating}
        onConfirm={() => void executeBulkStatus()}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  )
}
