import { useState, useEffect, useCallback, useId } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import {
  getOfferByIdAdmin,
  createOffer,
  updateOffer,
  type OfferFormInput,
  type OfferBankRuleInput,
} from "@/lib/supabase/queries/offers";
import { getBanksAdmin } from "@/lib/supabase/queries/admin-banks";
import { getCategoriesAdmin } from "@/lib/supabase/queries/admin-categories";
import { getMerchantsAdmin } from "@/lib/supabase/queries/admin-merchants";
import { getCardsAdmin } from "@/lib/supabase/queries/admin-cards";
import { slugify } from "@/utils/slugUtils";
import type {
  Bank,
  Card,
  Category,
  Merchant,
  Offer,
  OfferStatus,
  OfferSourceType,
} from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface BankRuleRow extends OfferBankRuleInput {
  _key: string;
}

interface FormState {
  title: string;
  slug: string;
  description: string;
  discount_text: string;
  merchant_id: string;
  category_id: string;
  valid_from: string;
  valid_to: string;
  terms_text: string;
  source_url: string;
  source_type: OfferSourceType;
  status: OfferStatus;
  is_featured: boolean;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  description: "",
  discount_text: "",
  merchant_id: "",
  category_id: "",
  valid_from: "",
  valid_to: "",
  terms_text: "",
  source_url: "",
  source_type: "manual",
  status: "draft",
  is_featured: false,
  is_active: true,
};

// ── Small reusable field wrapper ─────────────────────────────────────────────
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted mb-1 block">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminOfferFormPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const isEdit = !!offerId;
  const ruleKey = useId();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [bankRules, setBankRules] = useState<BankRuleRow[]>([]);
  const [linkedCardIds, setLinkedCardIds] = useState<Set<string>>(new Set());
  const [originalStatus, setOriginalStatus] = useState<OfferStatus>("draft");

  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});

  // ── Load reference data + existing offer ─────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, cat, mer, cards] = await Promise.all([
        getBanksAdmin(),
        getCategoriesAdmin(),
        getMerchantsAdmin(),
        getCardsAdmin(),
      ]);
      setBanks(b);
      setCategories(cat);
      setMerchants(mer);
      setAllCards(cards);

      if (isEdit && offerId) {
        const offer = await getOfferByIdAdmin(offerId);
        if (!offer) {
          setError("Offer not found");
          return;
        }
        populateForm(offer);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [isEdit, offerId]);

  useEffect(() => {
    void load();
  }, [load]);

  function populateForm(offer: Offer) {
    setForm({
      title: offer.title,
      slug: offer.slug,
      description: offer.description ?? "",
      discount_text: offer.discount_text ?? "",
      merchant_id: offer.merchant_id ?? "",
      category_id: offer.category_id ?? "",
      valid_from: offer.valid_from ?? "",
      valid_to: offer.valid_to ?? "",
      terms_text: offer.terms_text ?? "",
      source_url: offer.source_url ?? "",
      source_type: offer.source_type,
      status: offer.status,
      is_featured: offer.is_featured,
      is_active: offer.is_active,
    });
    setOriginalStatus(offer.status);
    setBankRules(
      (offer.offer_bank_rules ?? []).map((r, i) => ({
        _key: `${ruleKey}-${i}`,
        bank_id: r.bank_id,
        card_type: r.card_type,
        network: r.network,
      })),
    );
    setLinkedCardIds(
      new Set((offer.offer_cards ?? []).map((oc) => oc.card_id)),
    );
  }

  // ── Slug auto-generation ─────────────────────────────────────────────────
  function handleTitleChange(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: prev.slug === slugify(prev.title) ? slugify(title) : prev.slug,
    }));
  }

  // ── Bank rules ────────────────────────────────────────────────────────────
  function addRule() {
    setBankRules((prev) => [
      ...prev,
      {
        _key: `${ruleKey}-${Date.now()}`,
        bank_id: "",
        card_type: null,
        network: null,
      },
    ]);
  }

  function updateRule(key: string, patch: Partial<BankRuleRow>) {
    setBankRules((prev) =>
      prev.map((r) => (r._key === key ? { ...r, ...patch } : r)),
    );
  }

  function removeRule(key: string) {
    setBankRules((prev) => prev.filter((r) => r._key !== key));
  }

  // ── Linked cards ──────────────────────────────────────────────────────────
  function toggleCard(cardId: string) {
    setLinkedCardIds((prev) => {
      const next = new Set(prev);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      return next;
    });
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.slug.trim()) errs.slug = "Slug is required";
    if (!/^[a-z0-9-]+$/.test(form.slug))
      errs.slug = "Slug must be lowercase letters, numbers, and hyphens only";
    if (!form.discount_text.trim())
      errs.discount_text = "Discount text is required";
    if (form.valid_from && form.valid_to && form.valid_to < form.valid_from) {
      errs.valid_to = "Valid To must be after Valid From";
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setError(null);

    const validRules = bankRules.filter((r) => r.bank_id);

    const input: OfferFormInput = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description,
      discount_text: form.discount_text,
      merchant_id: form.merchant_id || null,
      category_id: form.category_id || null,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      terms_text: form.terms_text,
      source_url: form.source_url,
      source_type: form.source_type,
      status: form.status,
      is_featured: form.is_featured,
      is_active: form.is_active,
      country_code: "LK",
      bank_rules: validRules.map(({ _key: _, ...r }) => r),
      card_ids: Array.from(linkedCardIds),
    };

    try {
      if (isEdit && offerId) {
        await updateOffer(offerId, input, originalStatus === "approved");
      } else {
        await createOffer(input);
      }
      navigate("/admin/offers");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && loading === false && !form.title && isEdit) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted mb-3">{error}</p>
        <Link to="/admin/offers" className="text-sm text-primary underline">
          Back to offers
        </Link>
      </div>
    );
  }

  // Group cards by bank for the checkbox list
  const cardsByBank = banks
    .map((bank) => ({
      bank,
      cards: allCards.filter((c) => c.bank_id === bank.id),
    }))
    .filter((g) => g.cards.length > 0);

  return (
    <div className="p-6 max-w-3xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/offers"
            className="text-muted hover:text-content transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-content">
              {isEdit ? "Edit Offer" : "New Offer"}
            </h1>
            {isEdit && (
              <p className="text-xs text-muted font-mono">{offerId}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="admin-btn-primary flex items-center gap-1.5"
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save Offer"}
        </button>
      </div>

      {error && <div className="admin-error mb-5">{error}</div>}

      <div className="space-y-6">
        {/* ── Section 1: Basic Info ── */}
        <section className="bg-white border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-content mb-4">
            Basic Info
          </h2>
          <div className="space-y-4">
            <Field label="Title" required>
              <input
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className={`admin-input ${validationErrors.title ? "border-red-400" : ""}`}
                placeholder="20% Off Dining at Selected Restaurants"
              />
              {validationErrors.title && (
                <p className="text-xs text-red-500 mt-1">
                  {validationErrors.title}
                </p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Slug" required>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className={`admin-input font-mono text-xs ${validationErrors.slug ? "border-red-400" : ""}`}
                  placeholder="combank-20-off-dining"
                />
                {validationErrors.slug && (
                  <p className="text-xs text-red-500 mt-1">
                    {validationErrors.slug}
                  </p>
                )}
              </Field>
              <Field label="Discount Text" required>
                <input
                  value={form.discount_text}
                  onChange={(e) =>
                    setForm({ ...form, discount_text: e.target.value })
                  }
                  className={`admin-input ${validationErrors.discount_text ? "border-red-400" : ""}`}
                  placeholder="20% off"
                />
                {validationErrors.discount_text && (
                  <p className="text-xs text-red-500 mt-1">
                    {validationErrors.discount_text}
                  </p>
                )}
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="admin-input min-h-[80px] resize-y"
                placeholder="Full promotional description shown to users…"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Source URL">
                <input
                  value={form.source_url}
                  onChange={(e) =>
                    setForm({ ...form, source_url: e.target.value })
                  }
                  className="admin-input"
                  placeholder="https://www.combank.lk/rewards-promotions"
                />
              </Field>
              <Field label="Source Type">
                <select
                  value={form.source_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      source_type: e.target.value as OfferSourceType,
                    })
                  }
                  className="admin-input"
                >
                  <option value="manual">Manual</option>
                  <option value="scraped">Scraped</option>
                  <option value="imported">Imported</option>
                  <option value="bank_submission">Bank Submission</option>
                </select>
              </Field>
            </div>
          </div>
        </section>

        {/* ── Section 2: Classification + Status ── */}
        <section className="bg-white border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-content mb-4">
            Classification &amp; Status
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select
                value={form.category_id}
                onChange={(e) =>
                  setForm({ ...form, category_id: e.target.value })
                }
                className="admin-input"
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Merchant">
              <select
                value={form.merchant_id}
                onChange={(e) =>
                  setForm({ ...form, merchant_id: e.target.value })
                }
                className="admin-input"
              >
                <option value="">— None —</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as OfferStatus })
                }
                className="admin-input"
              >
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </Field>
            <div className="flex flex-col gap-3 pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) =>
                    setForm({ ...form, is_featured: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-sm text-content">Featured</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-sm text-content">Active</span>
              </label>
            </div>
          </div>
        </section>

        {/* ── Section 3: Validity ── */}
        <section className="bg-white border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-content mb-4">
            Validity Period
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valid From">
              <input
                type="date"
                value={form.valid_from}
                onChange={(e) =>
                  setForm({ ...form, valid_from: e.target.value })
                }
                className="admin-input"
              />
            </Field>
            <Field label="Valid To">
              <input
                type="date"
                value={form.valid_to}
                onChange={(e) => setForm({ ...form, valid_to: e.target.value })}
                className={`admin-input ${validationErrors.valid_to ? "border-red-400" : ""}`}
              />
              {validationErrors.valid_to && (
                <p className="text-xs text-red-500 mt-1">
                  {validationErrors.valid_to}
                </p>
              )}
            </Field>
          </div>
        </section>

        {/* ── Section 4: Terms ── */}
        <section className="bg-white border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-content mb-4">
            Terms &amp; Conditions
          </h2>
          <Field label="Terms (one per line)">
            <textarea
              value={form.terms_text}
              onChange={(e) => setForm({ ...form, terms_text: e.target.value })}
              className="admin-input min-h-[100px] resize-y font-mono text-xs"
              placeholder="Valid for dine-in only at participating restaurants.&#10;Maximum discount of Rs. 2,000 per transaction."
            />
            <p className="text-xs text-muted mt-1">
              Each line will be displayed as a separate term.
            </p>
          </Field>
        </section>

        {/* ── Section 5: Bank Rules ── */}
        <section className="bg-white border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-content">
                Bank Eligibility Rules
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Which bank cards are eligible. Leave card type / network blank
                to match all.
              </p>
            </div>
            <button
              onClick={addRule}
              className="admin-btn-ghost flex items-center gap-1.5 text-xs"
            >
              <Plus size={13} /> Add Rule
            </button>
          </div>

          {bankRules.length === 0 ? (
            <p className="text-xs text-muted text-center py-4 border border-dashed border-border rounded-xl">
              No rules yet — all cards from any bank can see this offer.
            </p>
          ) : (
            <div className="space-y-2">
              {bankRules.map((rule) => (
                <div
                  key={rule._key}
                  className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl"
                >
                  <select
                    value={rule.bank_id}
                    onChange={(e) =>
                      updateRule(rule._key, { bank_id: e.target.value })
                    }
                    className="admin-input flex-1 text-xs"
                  >
                    <option value="">— Select bank —</option>
                    {banks
                      .filter((b) => b.is_active)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                  <select
                    value={rule.card_type ?? ""}
                    onChange={(e) =>
                      updateRule(rule._key, {
                        card_type:
                          (e.target.value as "credit" | "debit") || null,
                      })
                    }
                    className="admin-input w-28 text-xs"
                  >
                    <option value="">Any type</option>
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                  </select>
                  <select
                    value={rule.network ?? ""}
                    onChange={(e) =>
                      updateRule(rule._key, {
                        network:
                          (e.target.value as
                            | "visa"
                            | "mastercard"
                            | "amex"
                            | "other") || null,
                      })
                    }
                    className="admin-input w-32 text-xs"
                  >
                    <option value="">Any network</option>
                    <option value="visa">Visa</option>
                    <option value="mastercard">Mastercard</option>
                    <option value="amex">Amex</option>
                    <option value="other">Other</option>
                  </select>
                  <button
                    onClick={() => removeRule(rule._key)}
                    className="text-muted hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 6: Linked Cards ── */}
        <section className="bg-white border border-border rounded-2xl p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-content">
              Explicit Card Links
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Optionally link to specific cards. These are checked alongside
              bank rules.
              {linkedCardIds.size > 0 && (
                <span className="ml-1 text-primary font-medium">
                  {linkedCardIds.size} selected
                </span>
              )}
            </p>
          </div>

          {cardsByBank.length === 0 ? (
            <p className="text-xs text-muted">No cards in the system yet.</p>
          ) : (
            <div className="space-y-4">
              {cardsByBank.map(({ bank, cards }) => (
                <div key={bank.id}>
                  <p className="text-xs font-semibold text-content mb-1.5">
                    {bank.name}
                  </p>
                  <div className="space-y-1 pl-2">
                    {cards.map((card) => (
                      <label
                        key={card.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={linkedCardIds.has(card.id)}
                          onChange={() => toggleCard(card.id)}
                          className="rounded"
                        />
                        <span className="text-sm text-content">
                          {card.name}
                        </span>
                        <span className="text-xs text-muted capitalize">
                          {card.card_type} · {card.network}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bottom save bar */}
        <div className="flex items-center justify-between pt-2 pb-6">
          <Link
            to="/admin/offers"
            className="admin-btn-ghost flex items-center gap-1.5"
          >
            <ArrowLeft size={14} /> Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="admin-btn-primary flex items-center gap-1.5"
          >
            <Save size={14} />
            {saving ? "Saving…" : isEdit ? "Update Offer" : "Create Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}
