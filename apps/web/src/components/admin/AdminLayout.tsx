import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  LogOut,
  CreditCard,
  Building2,
  Tag,
  Store,
  FileText,
  ExternalLink,
  Activity,
  Menu,
  X,
} from 'lucide-react'
import { signOut } from '@/lib/supabase/auth'
import { useAdminAuth } from '@/hooks/useAdminAuth'

const NAV_ITEMS = [
  { to: '/admin/dashboard',           label: 'Dashboard',         icon: LayoutDashboard },
  { to: '/admin/offers',              label: 'Offers',            icon: FileText },
  { to: '/admin/banks',               label: 'Banks',             icon: Building2 },
  { to: '/admin/cards',               label: 'Cards',             icon: CreditCard },
  { to: '/admin/categories',          label: 'Categories',        icon: Tag },
  { to: '/admin/merchants',           label: 'Merchants',         icon: Store },
  { to: '/admin/scraped-candidates',  label: 'Review Candidates', icon: Inbox },
  { to: '/admin/scrape-runs',         label: 'Scrape Runs',       icon: Activity },
] as const

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAdminAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar whenever the route changes (mobile nav tap)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-4 flex items-center justify-between gap-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <CreditCard size={14} className="text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-white text-xs font-bold">CardPromo LK</p>
            <p className="text-white/40 text-[10px]">Admin Panel</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-primary/20 text-primary font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}

        <div className="pt-3 pb-1">
          <div className="h-px bg-white/10 mx-1" />
        </div>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          <ExternalLink size={14} />
          View site
        </a>
      </nav>

      {/* User + Sign out */}
      <div className="p-3 border-t border-white/10 shrink-0 space-y-1">
        {session?.user.email && (
          <p className="text-[11px] text-white/30 px-3 truncate">
            {session.user.email}
          </p>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 text-sm transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ── Desktop sidebar (always visible ≥ md) ── */}
      <aside className="hidden md:flex w-56 bg-content flex-col shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          aria-hidden="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Sidebar panel — slides in from left */}
          <aside className="absolute left-0 top-0 h-full w-64 bg-content flex flex-col shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-content border-b border-white/10 flex items-center gap-3 px-4 h-14 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
              <CreditCard size={12} className="text-white" />
            </div>
            <span className="text-white text-sm font-bold">Admin Panel</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
