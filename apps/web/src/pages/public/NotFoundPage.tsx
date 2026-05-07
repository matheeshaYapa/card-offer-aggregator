import { Link } from 'react-router-dom'
import MetaTags from '@/components/seo/MetaTags'
import { Home, CreditCard } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <>
      <MetaTags
        title="Page Not Found"
        description="The page you are looking for does not exist."
        noIndex
      />
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
          <CreditCard size={28} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-content mb-2">404</h1>
        <p className="text-sm text-muted mb-6 max-w-xs">
          This page doesn't exist. It may have been moved or removed.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5
            rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors"
        >
          <Home size={15} />
          Back to promotions
        </Link>
      </div>
    </>
  )
}
