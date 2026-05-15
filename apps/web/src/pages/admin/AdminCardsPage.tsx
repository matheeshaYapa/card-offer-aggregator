import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminModal from '@/components/admin/AdminModal'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import StatusBadge from '@/components/admin/StatusBadge'
import {
  getCardsAdmin,
  upsertCard,
  toggleCardActive,
  type CardInput,
} from '@/lib/supabase/queries/admin-cards'
import { getBanksAdmin } from '@/lib/supabase/queries/admin-banks'
import { slugify } from '@/utils/slugUtils'
import type { Card, Bank } from '@/types'

type ModalState = null | 'new' | Card

const EMPTY: CardInput = {
  bank_id: '', name: '', slug: '',
  card_type: 'credit', network: 'visa',
  tier: '', is_active: true,
}

export default function AdminCardsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm] = useState<CardInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Card | null>(null)
  const [toggling, setToggling] = useState(false)
  const [bankFilter, setBankFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [c, b] = await Promise.all([getCardsAdmin(), getBanksAdmin()])
      setCards(c); setBanks(b)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function openNew() { setForm(EMPTY); setSaveError(null); setModal('new') }
  function openEdit(card: Card) {
    setForm({
      bank_id: card.bank_id, name: card.name, slug: card.slug,
      card_type: card.card_type, network: card.network,
      tier: card.tier ?? '', is_active: card.is_active,
    })
    setSaveError(null); setModal(card)
  }

  async function handleSave() {
    if (!form.bank_id || !form.name.trim() || !form.slug.trim()) {
      setSaveError('Bank, Name, and Slug are required.'); return
    }
    setSaving(true); setSaveError(null)
    try {
      await upsertCard(form, typeof modal === 'object' && modal !== null ? modal.id : undefined)
      setModal(null); await load()
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function handleToggle() {
    if (!confirmToggle) return
    setToggling(true)
    try { await toggleCardActive(confirmToggle.id, !confirmToggle.is_active); setConfirmToggle(null); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setToggling(false) }
  }

  const filtered = bankFilter ? cards.filter((c) => c.bank_id === bankFilter) : cards

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Cards"
        subtitle={`${cards.length} cards`}
        action={<button onClick={openNew} className="admin-btn-primary"><Plus size={14} /> New Card</button>}
      />
      {error && <div className="admin-error mb-4">{error}</div>}

      {/* Bank filter */}
      <div className="mb-4">
        <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="admin-input max-w-xs">
          <option value="">All banks</option>
          {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted text-center py-16">No cards{bankFilter ? ' for this bank' : ''}. Click "New Card" to add one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="admin-th">Name</th>
                <th className="admin-th">Bank</th>
                <th className="admin-th">Type</th>
                <th className="admin-th">Network</th>
                <th className="admin-th">Status</th>
                <th className="admin-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((card) => {
                const bank = banks.find((b) => b.id === card.bank_id)
                return (
                  <tr key={card.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="admin-td font-medium">{card.name}</td>
                    <td className="admin-td text-muted">{bank?.short_name ?? bank?.name ?? '—'}</td>
                    <td className="admin-td capitalize">{card.card_type}</td>
                    <td className="admin-td capitalize">{card.network}</td>
                    <td className="admin-td"><StatusBadge status={card.is_active ? 'active' : 'inactive'} /></td>
                    <td className="admin-td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(card)} className="admin-icon-btn" title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => setConfirmToggle(card)} className="admin-icon-btn">
                          {card.is_active ? <ToggleLeft size={15} /> : <ToggleRight size={15} className="text-primary" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <AdminModal
          title={modal === 'new' ? 'New Card' : `Edit: ${(modal as Card).name}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button onClick={() => setModal(null)} className="admin-btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="admin-btn-primary">{saving ? 'Saving…' : 'Save'}</button>
            </>
          }
        >
          {saveError && <div className="admin-error mb-3">{saveError}</div>}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Bank *</label>
              <select value={form.bank_id} onChange={(e) => setForm({ ...form, bank_id: e.target.value })} className="admin-input">
                <option value="">— Select bank —</option>
                {banks.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Name *</label>
              <input value={form.name} onChange={(e) => {
                const name = e.target.value
                setForm({ ...form, name, slug: form.slug === slugify(form.name) ? slugify(name) : form.slug })
              }} className="admin-input" placeholder="Visa Credit Card" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Slug *</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="admin-input font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Card Type *</label>
                <select value={form.card_type} onChange={(e) => setForm({ ...form, card_type: e.target.value as 'credit' | 'debit' })} className="admin-input">
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Network *</label>
                <select value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value as 'visa' | 'mastercard' | 'amex' | 'other' })} className="admin-input">
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">Amex</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Tier</label>
              <input value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} className="admin-input" placeholder="standard / gold / platinum" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
              <span className="text-sm text-content">Active</span>
            </label>
          </div>
        </AdminModal>
      )}

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.is_active ? 'Deactivate Card' : 'Activate Card'}
        message={`${confirmToggle?.is_active ? 'Deactivate' : 'Activate'} "${confirmToggle?.name}"?`}
        confirmLabel={confirmToggle?.is_active ? 'Deactivate' : 'Activate'}
        danger={confirmToggle?.is_active}
        loading={toggling}
        onConfirm={() => void handleToggle()}
        onCancel={() => setConfirmToggle(null)}
      />
    </div>
  )
}
