import { CreditCard } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="hidden md:block border-t border-border bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <CreditCard size={16} />
            CardPromo LK
          </div>
          <p className="text-xs text-muted text-center max-w-xl leading-relaxed">
            Promotion information is collected from public sources and may
            change without notice. Please verify the final offer details with
            the relevant bank or merchant before making a purchase.
          </p>
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} CardPromo LK
          </p>
        </div>
      </div>
    </footer>
  )
}
