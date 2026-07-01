import { NavLink } from 'react-router'
import { routes } from '../constants/routes'
import type { ModuleDef, NavItem } from '../constants/modules'
import { BrandMark } from './BrandMark'

/**
 * Per-module bottom nav: a leading Home item that returns to the hub, then the
 * active module's tabs. Rendered by AppShell only when inside a module.
 */
export function BottomNav({ module }: { module: ModuleDef }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-1 py-2.5 text-center text-section ${
      isActive ? 'text-accent' : 'text-text-secondary'
    }`

  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      {/* Home is the hub anchor: the brand mark in a subtle chip so it reads apart from the
          flat, module-specific tabs. Tint still tracks active/inactive on the whole link. */}
      <NavLink to={routes.home} className={linkClass}>
        <span className="-my-0.5 flex items-center justify-center rounded-pill bg-accent/20 px-3 py-0.5">
          <BrandMark className="size-[22px]" />
        </span>
        Home
      </NavLink>
      {module.tabs.map(({ to, label, Icon, end }: NavItem) => (
        <NavLink key={to} to={to} end={end} className={linkClass}>
          <Icon size={22} stroke={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
