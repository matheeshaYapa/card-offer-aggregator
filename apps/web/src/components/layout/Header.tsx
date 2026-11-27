import { Link, NavLink } from 'react-router-dom'
import { CreditCard, Wallet } from 'lucide-react'
import { useSelectedCards } from '@/hooks/useSelectedCards'

export default function Header() {
  const { selectedCards } = useSelectedCards()

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-[76rem] mx-auto px-4 min-h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-primary hover:opacity-80 transition-opacity"
        >
          <div className="size-9 bg-primary rounded-xl flex items-center justify-center">
            <CreditCard size={20} className="text-white" />
          </div>
          <span className="text-lg tracking-tight text-content">
            CardPromo <span className="text-primary font-semibold">LK</span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:text-content hover:bg-slate-50'
              }`
            }
          >
            Explore offers
          </NavLink>
          <NavLink
            to="/my-cards"
            className={({ isActive }) =>
              `px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:text-content hover:bg-slate-50'
              }`
            }
          >
            <Wallet size={14} />
            My Cards
            {selectedCards.length > 0 && (
              <span className="w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {selectedCards.length}
              </span>
            )}
          </NavLink>
        </nav>

        {/* Mobile: card count pill */}
        <Link
          to="/my-cards"
          className="md:hidden flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted hover:text-primary transition-colors"
          aria-label="My Cards"
        >
          <Wallet size={18} />
          {selectedCards.length > 0 && (
            <span className="w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {selectedCards.length}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
