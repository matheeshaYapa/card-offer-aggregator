import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminModal from '@/components/admin/AdminModal'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import StatusBadge from '@/components/admin/StatusBadge'
import {
  getMerchantsAdmin,
  upsertMerchant,
  toggleMerchantActive,
  type MerchantInput,
} from '@/lib/supabase/queries/admin-merchants'
import { getCategoriesAdmin } from '@/lib/supabase/queries/admin-categories'
import { slugify } from '@/utils/slugUtils'
import type { Merchant, Category } from '@/types'

type ModalState = null | 'new' | Merchant

const EMPTY: MerchantInput = {
  name: '', slug: '', category_id: null,
  website_url: '', country_code: 'LK', is_active: true,
}

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm] = useState<MerchantInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Merchant | null>(null)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [m, c] = await Promise.all([getMerchantsAdmin(), getCategoriesAdmin()])
      setMerchants(m); setCategories(c)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function openNew() { setForm(EMPTY); setSaveError(null); setModal('new') }
  function openEdit(m: Merchant) {
    setForm({
      name: m.name, slug: m.slug,
      category_id: m.category_id,
      website_url: m.website_url ?? '',
      country_code: m.country_code,
      is_active: m.is_active,
    })
    setSaveError(null); setModal(m)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) { setSaveError('Name and Slug are required.'); return }
    setSaving(true); setSaveError(null)
    try {
      await upsertMerchant(form, typeof modal === 'object' && modal !== null ? modal.id : undefined)
      setModal(null); await load()
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  async function handleToggle() {
    if (!confirmToggle) return
    setToggling(true)
    try {
      await toggleMerchantActive(confirmToggle.id, !confirmToggle.is_active)
      setConfirmToggle(null); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setToggling(false) }
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Merchants"
        subtitle={`${merchants.length} merchants`}
        action={<button onClick={openNew} className="admin-btn-primary"><Plus size={14} /> New Merchant</button>}
      />
      {error && <div className="admin-error mb-4">{error}</div>}

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : merchants.length === 0 ? (
          <p className="text-sm text-muted text-center py-16">No merchants yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="admin-th">Name</th>
                <th className="admin-th">Slug</th>
                <th className="admin-th">Category</th>
                <th className="admin-th">Status</th>
                <th className="admin-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {merchants.map((m) => {
                const cat = categories.find((c) => c.id === m.category_id)
                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="admin-td font-medium">{m.name}</td>
                    <td className="admin-td font-mono text-xs text-muted">{m.slug}</td>
                    <td className="admin-td text-muted">{cat?.name ?? '—'}</td>
                    <td className="admin-td"><StatusBadge status={m.is_active ? 'active' : 'inactive'} /></td>
                    <td className="admin-td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(m)} className="admin-icon-btn" title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => setConfirmToggle(m)} className="admin-icon-btn" title={m.is_active ? 'Deactivate' : 'Activate'}>
                          {m.is_active ? <ToggleLeft size={15} /> : <ToggleRight size={15} className="text-primary" />}
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
          title={modal === 'new' ? 'New Merchant' : `Edit: ${(modal as Merchant).name}`}
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
              <label className="text-xs font-medium text-muted mb-1 block">Name *</label>
              <input value={form.name} onChange={(e) => {
                const name = e.target.value
                setForm({ ...form, name, slug: form.slug === slugify(form.name) ? slugify(name) : form.slug })
              }} className="admin-input" placeholder="Keells Super" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Slug *</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="admin-input font-mono text-xs" placeholder="keells-super" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Category</label>
              <select value={form.category_id ?? ''} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })} className="admin-input">
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Website URL</label>
              <input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} className="admin-input" placeholder="https://www.keells.lk" />
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
        title={confirmToggle?.is_active ? 'Deactivate Merchant' : 'Activate Merchant'}
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
