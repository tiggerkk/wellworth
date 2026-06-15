import {
  IconApple,
  IconCalendarPlus,
  IconChartBar,
  IconNotebook,
  IconWallet,
  type Icon,
} from '@tabler/icons-react'
import { routes } from './routes'

export interface NavItem {
  to: string
  label: string
  Icon: Icon
  /** Match the path exactly (used for a module's index tab, like react-router's `end`). */
  end?: boolean
}

/**
 * A top-level app module shown on the Home hub. Adding a module is a drop-in:
 * append a `ModuleDef` here and register its routes in `router.tsx` — the hub
 * card and the per-module bottom nav are both derived from this list.
 */
export interface ModuleDef {
  key: string
  label: string
  Icon: Icon
  /** Module home path (also the hub card target). */
  base: string
  /** One-line description for the hub card. */
  description: string
  /** Bottom-nav tabs for this module (a Home item is appended by `BottomNav`). */
  tabs: NavItem[]
}

export const MODULES: ModuleDef[] = [
  {
    key: 'wellness',
    label: 'Wellness',
    Icon: IconApple,
    base: routes.wellness.base,
    description: 'Food, supplements & activity with full nutrient reporting.',
    tabs: [
      { to: routes.wellness.diary, label: 'Diary', Icon: IconNotebook, end: true },
      { to: routes.wellness.dashboard, label: 'Dashboard', Icon: IconChartBar },
      { to: routes.wellness.library, label: 'Library', Icon: IconApple },
    ],
  },
  {
    key: 'networth',
    label: 'Net Worth',
    Icon: IconWallet,
    base: routes.networth.base,
    description: 'Assets and net worth over time, in HKD.',
    tabs: [
      {
        to: routes.networth.dashboard,
        label: 'Dashboard',
        Icon: IconChartBar,
        end: true,
      },
      { to: routes.networth.entry, label: 'Monthly Entry', Icon: IconCalendarPlus },
    ],
  },
]

/** The module that owns a pathname, or null for hub/global-settings/login. */
export function moduleForPath(pathname: string): ModuleDef | null {
  return (
    MODULES.find((m) => pathname === m.base || pathname.startsWith(`${m.base}/`)) ?? null
  )
}
