import type { ReactNode } from 'react'
import { SearchX } from 'lucide-react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-muted">
        {icon ?? <SearchX size={24} />}
      </div>
      <h3 className="text-base font-semibold text-content mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
