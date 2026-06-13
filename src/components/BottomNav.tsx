import { NavLink } from 'react-router'
import {
  IconApple,
  IconChartBar,
  IconNotebook,
  IconSettings,
  type Icon,
} from '@tabler/icons-react'

interface NavItem {
  to: string
  label: string
  Icon: Icon
}

// Diary is the home tab (index route). Icon mapping per docs/04-design-system.md.
const ITEMS: NavItem[] = [
  { to: '/', label: 'Diary', Icon: IconNotebook },
  { to: '/dashboard', label: 'Dashboard', Icon: IconChartBar },
  { to: '/library', label: 'Library', Icon: IconApple },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
]

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      {ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
              isActive ? 'text-accent' : 'text-text-secondary'
            }`
          }
        >
          <Icon size={22} stroke={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
