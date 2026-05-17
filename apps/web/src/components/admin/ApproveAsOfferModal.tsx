/**
 * ApproveAsOfferModal
 *
 * Compact offer-creation form pre-filled from a scraped candidate.
 * On submit: creates an offer (source_type='scraped') and marks the
 * candidate as 'approved'. The candidate record is never deleted.
 */
import { useState, useEffect, useId } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import AdminModal from './AdminModal'
import { approveCandidateAsOffer } from '@/lib/supabase/queries/candidates'
import { getBanksAdmin } from '@/lib/supabase/queries/admin-banks'
import { getCategoriesAdmin } from '@/lib/supabase/queries/admin-categories'
import { getMerchantsAdmin } from '@/lib/supabase/queries/admin-merchants'
import { slugify } from '@/utils/slugUtils'
import type {
  Bank,
  Category,
  Merchant,
  OfferStatus,
  OfferSourceType,
  ScrapedOfferCandidate,
} from '@/types'
import type { OfferBankRuleInput } from '@/lib/supabase/queries/offers'

interface BankRuleRow extends OfferBankRuleInput {
  _key: string
}

interface FormState {
  title: string
  slug: string
  discount_text: string
  description: string
  merchant_id: string
  category_id: string
  valid_from: string
  valid_to: string
  source_url: string
  source_type: OfferSourceType
  status: OfferStatus
  terms_text: string
  is_featured: boolean
  is_active: boolean
}

function buildInitialForm(c: ScrapedOfferCandidate): FormState {
  const title = c.title ?? ''
  return {
    title,
    slug: slugify(title) + '-' + Date.now().toString(36),
    discount_text: c.detected_discount ?? '',
    description: c.description ?? '',
    merchant_id: '',
    category_id: '',
    valid_from: c.detected_valid_from ?? '',
    valid_to: c.detected_valid_to ?? '',
    source_url: c.source_url ?? '',
    source_type: 'scraped',
    status: 'pending_review',
    terms_text: '',
    is_featured: false,
    is_active: true,
  }
}

interface Props {
  candidate: ScrapedOfferCandidate
  onClose: () => void
  onApproved: (offerId: string) => void
}

export default function ApproveAsOfferModal({ candidate, onClose, onApproved }: Props) {
  const ruleKey = useId()

  const [form, setForm] = useState<FormState>(() => buildInitialForm(candidate))
  const [bankRules, setBankRules] = useState<BankRuleRow[]>(
    () => initialBankRule ? [initialBankRule] : [],
  )

  const [banks, setBanks] = useState<Bank[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [refLoading, setRefLoading] = useState(true)

  // Pre-populate a broad bank rule from the scrape source so the admin
  // doesn't have to add it manually every time.
  const initialBankRule: BankRuleRow | null = candidate.scrape_source?.bank_id
    ? { _key: `${ruleKey}-init`, bank_id: candidate.scrape_source.bank_id, card_type: null, network: null }
    : null

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  useEffect(() => {
    Promise.all([getBanksAdmin(), getCategoriesAdmin(), getMerchantsAdmin()])
      .then(([b, c, m]) => { setBanks(b); setCategories(c); setMerchants(m) })
      .finally(() => setRefLoading(false))
  }, [])

  function handleTitleChange(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: prev.slug.startsWith(slugify(prev.title))
        ? slugify(title) + '-' + Date.now().toString(36)
        : prev.slug,
    }))
  }

  function addRule() {
    setBankRules((prev) => [
      ...prev,
      { _key: `${ruleKey}-${Date.now()}`, bank_id: '', card_type: null, network: null },
    ])
  }

  function updateRule(key: string, patch: Partial<BankRuleRow>) {
    setBankRules((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)))
  }

  function removeRule(key: string) {
    setBankRules((prev) => prev.filter((r) => r._key !== key))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.slug.trim()) errs.slug = 'Slug is required'
    if (!form.discount_text.trim()) errs.discount_text = 'Discount text is required'
    if (form.valid_from && form.valid_to && form.valid_to < form.valid_from)
      errs.valid_to = 'Valid To must be after Valid From'
    setValidationErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    setError(null)
    try {
      const offerId = await approveCandidateAsOffer(candidate.id, {
        title: form.title.trim(),
        slug: form.slug.trim(),
        discount_text: form.discount_text,
        description: form.description,
        merchant_id: form.merchant_id || null,
        category_id: form.category_id || null,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        source_url: form.source_url,
        source_type: form.source_type,
        terms_text: form.terms_text,
        status: form.status,
        is_featured: form.is_featured,
        is_active: form.is_active,
        country_code: 'LK',
        bank_rules: bankRules.filter((r) => r.bank_id).map(({ _key: _, ...r }) => r),
        card_ids: [],
      })
      onApproved(offerId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create offer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminModal
      title="Approve as Offer"
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="admin-btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving || refLoading} className="admin-btn-primary">
            {saving ? 'Creating offer…' : 'Create Offer & Approve'}
          </button>
        </>
      }
    >
      {error && <div className="admin-error mb-4">{error}</div>}

      {refLoading ? (
        <div className="py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Candidate info strip */}
          <div className="bg-slate-50 border border-border rounded-xl px-4 py-2.5 text-xs text-muted">
            Candidate: <span className="text-content font-medium">{candidate.title ?? '(no title)'}</span>
            {candidate.scrape_source && (
              <> · Source: <span className="text-content">{candidate.scrape_source.name}</span></>
            )}
          </div>

          {/* Section 1: Basic info */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-content uppercase tracking-wider">Basic Info</h3>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Title *</label>
              <input
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className={`admin-input ${validationErrors.title ? 'border-red-400' : ''}`}
                placeholder="20% Off Dining at Selected Restaurants"
              />
              {validationErrors.title && <p className="text-xs text-red-500 mt-1">{validationErrors.title}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Slug *</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className={`admin-input font-mono text-xs ${validationErrors.slug ? 'border-red-400' : ''}`}
                />
                {validationErrors.slug && <p className="text-xs text-red-500 mt-1">{validationErrors.slug}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Discount Text *</label>
                <input
                  value={form.discount_text}
                  onChange={(e) => setForm({ ...form, discount_text: e.target.value })}
                  className={`admin-input ${validationErrors.discount_text ? 'border-red-400' : ''}`}
                  placeholder="20% off"
                />
                {validationErrors.discount_text && <p className="text-xs text-red-500 mt-1">{validationErrors.discount_text}</p>}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="admin-input min-h-[70px] resize-y"
              />
            </div>
          </section>

          {/* Section 2: Classification + Status */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-content uppercase tracking-wider">Classification</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Category</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="admin-input">
                  <option value="">— None —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Merchant</label>
                <select value={form.merchant_id} onChange={(e) => setForm({ ...form, merchant_id: e.target.value })} className="admin-input">
                  <option value="">— None —</option>
                  {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OfferStatus })} className="admin-input">
                  <option value="pending_review">Pending Review</option>
                  <option value="approved">Approved (publish immediately)</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Source URL</label>
                <input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} className="admin-input" />
              </div>
            </div>
          </section>

          {/* Section 3: Validity */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-content uppercase tracking-wider">Validity</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Valid From</label>
                <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} className="admin-input" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted mb-1 block">Valid To</label>
                <input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} className={`admin-input ${validationErrors.valid_to ? 'border-red-400' : ''}`} />
                {validationErrors.valid_to && <p className="text-xs text-red-500 mt-1">{validationErrors.valid_to}</p>}
              </div>
            </div>
          </section>

          {/* Section 4: Bank Eligibility Rules */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-content uppercase tracking-wider">Bank Eligibility Rules</h3>
              <button onClick={addRule} className="admin-btn-ghost text-xs flex items-center gap-1">
                <Plus size={12} /> Add Rule
              </button>
            </div>
            {bankRules.length === 0 ? (
              <p className="text-xs text-muted border border-dashed border-border rounded-xl py-3 text-center">
                No rules — offer visible to all banks. Add rules to restrict eligibility.
              </p>
            ) : (
              <div className="space-y-2">
                {bankRules.map((rule) => (
                  <div key={rule._key} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl">
                    <select value={rule.bank_id} onChange={(e) => updateRule(rule._key, { bank_id: e.target.value })} className="admin-input flex-1 text-xs">
                      <option value="">— Bank —</option>
                      {banks.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select value={rule.card_type ?? ''} onChange={(e) => updateRule(rule._key, { card_type: (e.target.value as 'credit' | 'debit') || null })} className="admin-input w-28 text-xs">
                      <option value="">Any type</option>
                      <option value="credit">Credit</option>
                      <option value="debit">Debit</option>
                    </select>
                    <select value={rule.network ?? ''} onChange={(e) => updateRule(rule._key, { network: (e.target.value as 'visa' | 'mastercard' | 'amex' | 'other') || null })} className="admin-input w-32 text-xs">
                      <option value="">Any network</option>
                      <option value="visa">Visa</option>
                      <option value="mastercard">Mastercard</option>
                      <option value="amex">Amex</option>
                      <option value="other">Other</option>
                    </select>
                    <button onClick={() => removeRule(rule._key)} className="text-muted hover:text-red-500 transition-colors shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminModal>
  )
}
