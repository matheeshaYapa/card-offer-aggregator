import { NavLink } from 'react-router-dom'
import { Home, Wallet } from 'lucide-react'
import { useSelectedCards } from '@/hooks/useSelectedCards'

export default function BottomNav() {
  const { selectedCards } = useSelectedCards()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-border safe-area-inset-bottom">
      <div className="flex h-16">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
              isActive ? 'text-primary' : 'text-muted'
            }`
          }
        >
          <Home size={20} />
          <span>Promotions</span>
        </NavLink>

        <NavLink
          to="/my-cards"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors relative ${
              isActive ? 'text-primary' : 'text-muted'
            }`
          }
        >
          <div className="relative">
            <Wallet size={20} />
            {selectedCards.length > 0 && (
              <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {selectedCards.length}
              </span>
            )}
          </div>
          <span>My Cards</span>
        </NavLink>
      </div>
    </nav>
  )
}
