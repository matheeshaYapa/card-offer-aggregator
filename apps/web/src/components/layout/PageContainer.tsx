import { Outlet } from 'react-router-dom'
import Header from './Header'
import BottomNav from './BottomNav'
import Footer from './Footer'

export default function PageContainer() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      <Header />
      <main className="flex-1 main-content">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
