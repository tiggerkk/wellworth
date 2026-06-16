import { NavLink } from 'react-router'
import { IconHome } from '@tabler/icons-react'
import { routes } from '../constants/routes'
import type { ModuleDef, NavItem } from '../constants/modules'

/**
 * Per-module bottom nav: a leading Home item that returns to the hub, then the
 * active module's tabs. Rendered by AppShell only when inside a module.
 */
export function BottomNav({ module }: { module: ModuleDef }) {
  const items: NavItem[] = [
    { to: routes.home, label: 'Home', Icon: IconHome },
    ...module.tabs,
  ]

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      {items.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
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
