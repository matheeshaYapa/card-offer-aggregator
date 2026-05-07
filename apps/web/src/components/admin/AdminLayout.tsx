import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import { signOut } from '@/lib/supabase/auth'
import { useAdminAuth } from '@/hooks/useAdminAuth'

const NAV_ITEMS = [
  { to: '/admin/dashboard',           label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/admin/offers',              label: 'Offers',          icon: FileText },
  { to: '/admin/banks',               label: 'Banks',           icon: Building2 },
  { to: '/admin/cards',               label: 'Cards',           icon: CreditCard },
  { to: '/admin/categories',          label: 'Categories',      icon: Tag },
  { to: '/admin/merchants',           label: 'Merchants',       icon: Store },
  { to: '/admin/scraped-candidates',  label: 'Review Candidates', icon: Inbox },
  { to: '/admin/scrape-runs',         label: 'Scrape Runs',       icon: Activity },
] as const

export default function AdminLayout() {
  const navigate = useNavigate()
  const { session } = useAdminAuth()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 bg-content flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-4 flex items-center gap-2 border-b border-white/10 shrink-0">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <CreditCard size={14} className="text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-white text-xs font-bold">CardPromo LK</p>
            <p className="text-white/40 text-[10px]">Admin Panel</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
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
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/60 transition-colors"
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
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
