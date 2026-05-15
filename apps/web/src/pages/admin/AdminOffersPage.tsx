import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, ToggleLeft, ToggleRight, ExternalLink, RefreshCw } from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { getAllOffersAdmin, toggleOfferActive, updateOfferStatus } from '@/lib/supabase/queries/offers'
import { formatDate } from '@/utils/dateUtils'
import type { Offer, OfferStatus } from '@/types'

const STATUS_TABS: Array<{ value: OfferStatus | 'all'; label: string }> = [
  { value: 'all',           label: 'All' },
  { value: 'approved',      label: 'Approved' },
  { value: 'draft',         label: 'Draft' },
  { value: 'pending_review',label: 'Pending' },
  { value: 'rejected',      label: 'Rejected' },
  { value: 'expired',       label: 'Expired' },
]

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OfferStatus | 'all'>('all')
  const [confirmToggle, setConfirmToggle] = useState<Offer | null>(null)
  const [toggling, setToggling] = useState(false)
  const [quickStatus, setQuickStatus] = useState<{ offer: Offer; status: OfferStatus } | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setOffers(await getAllOffersAdmin()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

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

  const filtered = statusFilter === 'all'
    ? offers
    : offers.filter((o) => o.status === statusFilter)

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

      {error && <div className="admin-error mb-4">{error} <button onClick={() => void load()} className="ml-1 underline text-xs">Retry</button></div>}

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
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
        <button onClick={() => void load()} className="shrink-0 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-content border border-border ml-auto">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted text-center py-16">No offers in this status.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
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
                    new Map((offer.offer_bank_rules ?? []).filter((r) => r.bank).map((r) => [r.bank!.id, r.bank!])).values()
                  )
                  return (
                    <tr key={offer.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="admin-td">
                        <div>
                          <p className="font-medium text-content line-clamp-1">{offer.title}</p>
                          {offer.is_featured && <span className="text-[10px] text-amber-600 font-medium">⭐ Featured</span>}
                        </div>
                      </td>
                      <td className="admin-td text-muted text-xs">
                        {banks.slice(0, 2).map((b) => b.short_name ?? b.name).join(', ')}
                        {banks.length > 2 && ` +${banks.length - 2}`}
                      </td>
                      <td className="admin-td text-muted">{offer.discount_text ?? '—'}</td>
                      <td className="admin-td">
                        <select
                          value={offer.status}
                          onChange={(e) => setQuickStatus({ offer, status: e.target.value as OfferStatus })}
                          className="text-xs border-0 bg-transparent p-0 cursor-pointer focus:outline-none"
                        >
                          {(['draft','pending_review','approved','rejected','expired'] as OfferStatus[]).map((s) => (
                            <option key={s} value={s}>{s.replace('_', ' ')}</option>
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
                          <Link to={`/admin/offers/${offer.id}/edit`} className="admin-icon-btn" title="Edit">
                            <Pencil size={13} />
                          </Link>
                          <button onClick={() => setConfirmToggle(offer)} className="admin-icon-btn" title={offer.is_active ? 'Deactivate' : 'Activate'}>
                            {offer.is_active ? <ToggleLeft size={15} /> : <ToggleRight size={15} className="text-primary" />}
                          </button>
                          {offer.status === 'approved' && (
                            <a href={`/offer/${offer.slug}`} target="_blank" rel="noopener noreferrer" className="admin-icon-btn" title="View public page">
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

      {/* Confirm status change */}
      <ConfirmDialog
        open={!!quickStatus}
        title="Change Status"
        message={`Change "${quickStatus?.offer.title}" status to "${quickStatus?.status.replace('_', ' ')}"?`}
        confirmLabel="Update"
        loading={updatingStatus}
        onConfirm={() => void handleQuickStatus()}
        onCancel={() => setQuickStatus(null)}
      />
    </div>
  )
}
