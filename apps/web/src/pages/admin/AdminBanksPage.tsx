import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import AdminModal from '@/components/admin/AdminModal'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import StatusBadge from '@/components/admin/StatusBadge'
import {
  getBanksAdmin,
  upsertBank,
  toggleBankActive,
  type BankInput,
} from '@/lib/supabase/queries/admin-banks'
import { slugify } from '@/utils/slugUtils'
import type { Bank } from '@/types'

type ModalState = null | 'new' | Bank

const EMPTY: BankInput = {
  name: '', slug: '', short_name: '',
  website_url: '', country_code: 'LK', is_active: true,
}

function BankForm({
  value,
  onChange,
}: {
  value: BankInput
  onChange: (v: BankInput) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">Name *</label>
        <input
          value={value.name}
          onChange={(e) => {
            const name = e.target.value
            onChange({
              ...value,
              name,
              slug: value.slug === slugify(value.name) ? slugify(name) : value.slug,
            })
          }}
          className="admin-input"
          placeholder="Commercial Bank of Ceylon"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">Slug *</label>
        <input
          value={value.slug}
          onChange={(e) => onChange({ ...value, slug: e.target.value })}
          className="admin-input font-mono text-xs"
          placeholder="commercial-bank"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">Short Name</label>
        <input
          value={value.short_name}
          onChange={(e) => onChange({ ...value, short_name: e.target.value })}
          className="admin-input"
          placeholder="ComBank"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted mb-1 block">Website URL</label>
        <input
          value={value.website_url}
          onChange={(e) => onChange({ ...value, website_url: e.target.value })}
          className="admin-input"
          placeholder="https://www.combank.lk"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.is_active}
          onChange={(e) => onChange({ ...value, is_active: e.target.checked })}
          className="rounded"
        />
        <span className="text-sm text-content">Active</span>
      </label>
    </div>
  )
}

export default function AdminBanksPage() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm] = useState<BankInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Bank | null>(null)
  const [toggling, setToggling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setBanks(await getBanksAdmin()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function openNew() { setForm(EMPTY); setSaveError(null); setModal('new') }
  function openEdit(bank: Bank) {
    setForm({
      name: bank.name, slug: bank.slug,
      short_name: bank.short_name ?? '',
      website_url: bank.website_url ?? '',
      country_code: bank.country_code, is_active: bank.is_active,
    })
    setSaveError(null)
    setModal(bank)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) {
      setSaveError('Name and Slug are required.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await upsertBank(form, typeof modal === 'object' && modal !== null ? modal.id : undefined)
      setModal(null)
      await load()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle() {
    if (!confirmToggle) return
    setToggling(true)
    try {
      await toggleBankActive(confirmToggle.id, !confirmToggle.is_active)
      setConfirmToggle(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Banks"
        subtitle={`${banks.length} banks`}
        action={
          <button onClick={openNew} className="admin-btn-primary">
            <Plus size={14} /> New Bank
          </button>
        }
      />

      {error && <div className="admin-error mb-4">{error}<button onClick={() => void load()} className="ml-2 underline">Retry</button></div>}

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : banks.length === 0 ? (
          <p className="text-sm text-muted text-center py-16">No banks yet. Click "New Bank" to add one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="admin-th">Name</th>
                <th className="admin-th">Slug</th>
                <th className="admin-th">Short Name</th>
                <th className="admin-th">Status</th>
                <th className="admin-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {banks.map((bank) => (
                <tr key={bank.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="admin-td font-medium">{bank.name}</td>
                  <td className="admin-td font-mono text-xs text-muted">{bank.slug}</td>
                  <td className="admin-td text-muted">{bank.short_name ?? '—'}</td>
                  <td className="admin-td">
                    <StatusBadge status={bank.is_active ? 'active' : 'inactive'} />
                  </td>
                  <td className="admin-td text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(bank)} className="admin-icon-btn" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmToggle(bank)}
                        className="admin-icon-btn"
                        title={bank.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {bank.is_active ? <ToggleLeft size={15} /> : <ToggleRight size={15} className="text-primary" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit modal */}
      {modal !== null && (
        <AdminModal
          title={modal === 'new' ? 'New Bank' : `Edit: ${(modal as Bank).name}`}
          onClose={() => setModal(null)}
          size="md"
          footer={
            <>
              <button onClick={() => setModal(null)} className="admin-btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="admin-btn-primary">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          {saveError && <div className="admin-error mb-3">{saveError}</div>}
          <BankForm value={form} onChange={setForm} />
        </AdminModal>
      )}

      {/* Confirm deactivate/activate */}
      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.is_active ? 'Deactivate Bank' : 'Activate Bank'}
        message={`Are you sure you want to ${confirmToggle?.is_active ? 'deactivate' : 'activate'} "${confirmToggle?.name}"?`}
        confirmLabel={confirmToggle?.is_active ? 'Deactivate' : 'Activate'}
        danger={confirmToggle?.is_active}
        loading={toggling}
        onConfirm={() => void handleToggle()}
        onCancel={() => setConfirmToggle(null)}
      />

      {/* Refresh button */}
      <button onClick={() => void load()} className="mt-4 flex items-center gap-1.5 text-xs text-muted hover:text-content transition-colors">
        <RefreshCw size={11} /> Refresh
      </button>
    </div>
  )
}
