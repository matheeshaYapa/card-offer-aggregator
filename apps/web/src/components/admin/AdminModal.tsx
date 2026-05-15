import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface AdminModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export default function AdminModal({
  title,
  onClose,
  children,
  size = 'md',
  footer,
}: AdminModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — full-width sheet on mobile, centred card on sm+ */}
      <div
        className={`relative bg-white w-full flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92dvh] sm:max-h-[90vh] ${sizeClasses[size]}`}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-content">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-content hover:bg-slate-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>

        {/* Footer — buttons wrap on narrow screens */}
        {footer && (
          <div className="px-5 py-4 border-t border-border shrink-0 flex flex-wrap justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
