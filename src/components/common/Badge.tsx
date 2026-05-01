import type { ReactNode } from 'react'

type BadgeVariant =
  | 'primary'
  | 'accent'
  | 'muted'
  | 'success'
  | 'danger'
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'credit'
  | 'debit'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-amber-700',
  muted: 'bg-slate-100 text-muted',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-red-100 text-red-600',
  visa: 'bg-blue-100 text-blue-700',
  mastercard: 'bg-orange-100 text-orange-700',
  amex: 'bg-indigo-100 text-indigo-700',
  credit: 'bg-primary/10 text-primary',
  debit: 'bg-emerald-100 text-emerald-700',
}

export default function Badge({
  children,
  variant = 'muted',
  size = 'sm',
  className = '',
}: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
