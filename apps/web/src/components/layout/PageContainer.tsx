import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import BottomNav from './BottomNav'
import Footer from './Footer'

export default function PageContainer() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])

  return (
    <div className="min-h-screen flex flex-col bg-bg-base">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-2 focus:left-2 browse-action">Skip to content</a>
      <Header />
      <main id="main-content" className="flex-1 main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
