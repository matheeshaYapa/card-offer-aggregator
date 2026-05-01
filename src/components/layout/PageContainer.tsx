import type { ReactNode } from 'react'
import Header from './Header'
import BottomNav from './BottomNav'
import Footer from './Footer'

interface PageContainerProps {
  children: ReactNode
}

export default function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      <Header />
      <main className="flex-1 main-content">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  )
}
