import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil } from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminModal from '@/components/admin/AdminModal'
import StatusBadge from '@/components/admin/StatusBadge'
import {
  getCategoriesAdmin,
  upsertCategory,
  type CategoryInput,
} from '@/lib/supabase/queries/admin-categories'
import { slugify } from '@/utils/slugUtils'
import type { Category } from '@/types'

type ModalState = null | 'new' | Category

const EMPTY: CategoryInput = { name: '', slug: '', icon: '', is_active: true }

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm] = useState<CategoryInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setCats(await getCategoriesAdmin()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function openNew() { setForm(EMPTY); setSaveError(null); setModal('new') }
  function openEdit(cat: Category) {
    setForm({ name: cat.name, slug: cat.slug, icon: cat.icon ?? '', is_active: cat.is_active })
    setSaveError(null); setModal(cat)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) { setSaveError('Name and Slug are required.'); return }
    setSaving(true); setSaveError(null)
    try {
      await upsertCategory(form, typeof modal === 'object' && modal !== null ? modal.id : undefined)
      setModal(null); await load()
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6">
      <AdminPageHeader
        title="Categories"
        subtitle={`${cats.length} categories`}
        action={
          <button onClick={openNew} className="admin-btn-primary">
            <Plus size={14} /> New Category
          </button>
        }
      />
      {error && <div className="admin-error mb-4">{error}</div>}

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : cats.length === 0 ? (
          <p className="text-sm text-muted text-center py-16">No categories yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="admin-th">Name</th>
                <th className="admin-th">Slug</th>
                <th className="admin-th">Icon</th>
                <th className="admin-th">Status</th>
                <th className="admin-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cats.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="admin-td font-medium">{cat.name}</td>
                  <td className="admin-td font-mono text-xs text-muted">{cat.slug}</td>
                  <td className="admin-td text-muted">{cat.icon ?? '—'}</td>
                  <td className="admin-td"><StatusBadge status={cat.is_active ? 'active' : 'inactive'} /></td>
                  <td className="admin-td text-right">
                    <button onClick={() => openEdit(cat)} className="admin-icon-btn" title="Edit"><Pencil size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <AdminModal
          title={modal === 'new' ? 'New Category' : `Edit: ${(modal as Category).name}`}
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
              }} className="admin-input" placeholder="Dining" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Slug *</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="admin-input font-mono text-xs" placeholder="dining" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Icon (lucide name)</label>
              <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="admin-input" placeholder="UtensilsCrossed" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
              <span className="text-sm text-content">Active</span>
            </label>
          </div>
        </AdminModal>
      )}
    </div>
  )
}
