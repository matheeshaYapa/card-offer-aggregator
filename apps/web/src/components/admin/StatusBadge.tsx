import type { CandidateStatus, OfferStatus, ScrapeRunStatus } from '@/types'

type BadgeStatus =
  | OfferStatus
  | CandidateStatus
  | ScrapeRunStatus
  | 'active'
  | 'inactive'

interface StatusBadgeProps {
  status: BadgeStatus
}

const CONFIG: Record<string, { label: string; className: string }> = {
  // Offer statuses
  draft:          { label: 'Draft',          className: 'bg-slate-100 text-slate-600' },
  pending_review: { label: 'Pending Review', className: 'bg-amber-100 text-amber-700' },
  approved:       { label: 'Approved',       className: 'bg-emerald-100 text-emerald-700' },
  rejected:       { label: 'Rejected',       className: 'bg-red-100 text-red-600' },
  expired:        { label: 'Expired',        className: 'bg-gray-100 text-gray-500' },
  // Candidate statuses
  pending:        { label: 'Pending',        className: 'bg-amber-100 text-amber-700' },
  duplicate:      { label: 'Duplicate',      className: 'bg-purple-100 text-purple-600' },
  // Scrape run statuses
  running:        { label: 'Running',        className: 'bg-blue-100 text-blue-700' },
  success:        { label: 'Success',        className: 'bg-emerald-100 text-emerald-700' },
  failed:         { label: 'Failed',         className: 'bg-red-100 text-red-600' },
  partial:        { label: 'Partial',        className: 'bg-orange-100 text-orange-600' },
  // Generic
  active:         { label: 'Active',         className: 'bg-emerald-100 text-emerald-700' },
  inactive:       { label: 'Inactive',       className: 'bg-slate-100 text-slate-500' },
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
