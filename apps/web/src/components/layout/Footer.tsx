import { Link } from 'react-router-dom'
import { CreditCard } from 'lucide-react'

/**
 * Footer link sets. Hardcoded (rather than fetched) so the internal links are
 * present in the prerendered HTML for SEO crawlers. Keep these slugs in sync
 * with the SEED_* lists in scripts/prerender.ts so every link resolves to a
 * prerendered page.
 */
const FOOTER_BANKS: { slug: string; name: string }[] = [
  { slug: 'commercial-bank', name: 'Commercial Bank' },
  { slug: 'hnb', name: 'HNB' },
  { slug: 'sampath-bank', name: 'Sampath Bank' },
  { slug: 'boc', name: 'BOC' },
  { slug: 'peoples-bank', name: "People's Bank" },
]

const FOOTER_CATEGORIES: { slug: string; name: string }[] = [
  { slug: 'dining', name: 'Dining' },
  { slug: 'supermarket', name: 'Supermarket' },
  { slug: 'travel', name: 'Travel' },
  { slug: 'shopping', name: 'Shopping' },
  { slug: 'electronics', name: 'Electronics' },
]

export default function Footer() {
  return (
    <footer className="hidden md:block border-t border-border bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-6">
          {/* Brand */}
          <div className="lg:col-span-2 max-w-sm">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              <CreditCard size={16} />
              CardPromo <span className="text-content/60">LK</span>
            </Link>
            <p className="text-xs text-muted leading-relaxed mt-2">
              Discover credit and debit card promotions from Sri Lanka's leading
              banks — dining, shopping, travel, supermarket and more, all in one
              place.
            </p>
          </div>

          {/* Banks */}
          <nav aria-label="Browse by bank">
            <h2 className="text-xs font-semibold text-content mb-2.5">Banks</h2>
            <ul className="space-y-1.5">
              {FOOTER_BANKS.map((bank) => (
                <li key={bank.slug}>
                  <Link
                    to={`/bank/${bank.slug}`}
                    className="text-xs text-muted hover:text-primary transition-colors"
                  >
                    {bank.name} offers
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Categories */}
          <nav aria-label="Browse by category">
            <h2 className="text-xs font-semibold text-content mb-2.5">Categories</h2>
            <ul className="space-y-1.5">
              {FOOTER_CATEGORIES.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    to={`/category/${cat.slug}`}
                    className="text-xs text-muted hover:text-primary transition-colors"
                  >
                    {cat.name} offers
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Disclaimer + copyright */}
        <div className="border-t border-border pt-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted text-center md:text-left max-w-xl leading-relaxed">
            Promotion information is collected from public sources and may change
            without notice. Please verify the final offer details with the
            relevant bank or merchant before making a purchase.
          </p>
          <p className="text-xs text-muted shrink-0">
            © {new Date().getFullYear()} CardPromo LK
          </p>
        </div>
      </div>
    </footer>
  )
}
