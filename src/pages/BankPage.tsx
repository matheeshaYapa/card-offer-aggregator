import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Building2 } from 'lucide-react'
import MetaTags from '@/components/seo/MetaTags'
import OfferGrid from '@/components/offers/OfferGrid'
import { isOfferExpired } from '@/utils/dateUtils'
import banksData from '@/data/banks.json'
import offersData from '@/data/offers.json'
import type { Offer } from '@/types'

export default function BankPage() {
  const { bankId } = useParams<{ bankId: string }>()

  const bank = banksData.find((b) => b.id === bankId)

  if (!bank) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <MetaTags title="Bank Not Found" description="This bank page could not be found." noIndex />
        <h1 className="text-lg font-bold text-content mb-2">Bank not found</h1>
        <Link to="/" className="text-sm text-primary underline underline-offset-2">
          Browse all promotions
        </Link>
      </div>
    )
  }

  const offers = (offersData as Offer[]).filter(
    (o) => o.isActive && !isOfferExpired(o) && o.bankIds.includes(bank.id),
  )

  return (
    <>
      <MetaTags
        title={`${bank.name} Credit Card Promotions`}
        description={`Browse all active ${bank.name} credit and debit card promotions in Sri Lanka. Find dining, shopping, travel and supermarket offers.`}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-content transition-colors mb-5"
        >
          <ArrowLeft size={15} />
          All promotions
        </Link>

        {/* Bank header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content">{bank.name}</h1>
            <p className="text-sm text-muted">
              {offers.length} active promotion{offers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <OfferGrid offers={offers} />
      </div>
    </>
  )
}
