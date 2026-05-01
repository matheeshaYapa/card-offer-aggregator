import { Routes, Route } from 'react-router-dom'
import PageContainer from '@/components/layout/PageContainer'
import HomePage from '@/pages/HomePage'
import MyCardsPage from '@/pages/MyCardsPage'
import OfferDetailsPage from '@/pages/OfferDetailsPage'
import BankPage from '@/pages/BankPage'
import CategoryPage from '@/pages/CategoryPage'
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  return (
    <PageContainer>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/my-cards" element={<MyCardsPage />} />
        <Route path="/offer/:offerId" element={<OfferDetailsPage />} />
        <Route path="/bank/:bankId" element={<BankPage />} />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </PageContainer>
  )
}
