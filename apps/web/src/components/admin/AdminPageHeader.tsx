import type { ReactNode } from 'react'

interface AdminPageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function AdminPageHeader({
  title,
  subtitle,
  action,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-bold text-content">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
