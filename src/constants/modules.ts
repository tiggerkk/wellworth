import {
  IconApple,
  IconBook,
  IconCalendarPlus,
  IconChartBar,
  IconDeviceTv,
  IconFeather,
  IconFileCertificate,
  IconHeart,
  IconHeartbeat,
  IconLibrary,
  IconList,
  IconMap,
  IconNotebook,
  IconQuote,
  IconReportMedical,
  IconSettings,
  IconSparkles,
  IconUsers,
  IconWallet,
  IconWorld,
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

// Hub order is the linear reading order of the 2-column Home grid (left→right, top→down):
// row 1 = Wellness | Net Worth, row 2 = Quotes | Literature, row 3 = Shows | Books,
// row 4 = Travel | Medical. This is only the default — users reorder via Visible Modules
// (`profile.module_order`). `description` is kept short so it fits one truncated line in a
// half-width hub card.
export const MODULES: ModuleDef[] = [
  {
    key: 'wellness',
    label: 'Wellness',
    Icon: IconApple,
    base: routes.wellness.base,
    description: 'Food, supplements & activity',
    tabs: [
      { to: routes.wellness.dashboard, label: 'Dashboard', Icon: IconChartBar },
      { to: routes.wellness.diary, label: 'Diary', Icon: IconNotebook, end: true },
      { to: routes.wellness.library, label: 'Library', Icon: IconApple },
      { to: routes.wellness.settings, label: 'Settings', Icon: IconSettings },
    ],
  },
  {
    key: 'networth',
    label: 'Net Worth',
    Icon: IconWallet,
    base: routes.networth.base,
    description: 'Assets over time, in HKD',
    tabs: [
      {
        to: routes.networth.dashboard,
        label: 'Dashboard',
        Icon: IconChartBar,
        end: true,
      },
      { to: routes.networth.entry, label: 'Monthly Entry', Icon: IconCalendarPlus },
      {
        to: routes.networth.insurancePolicies,
        label: 'Insurance Policies',
        Icon: IconLibrary,
      },
      {
        to: routes.networth.insuranceEntry,
        label: 'New Insurance',
        Icon: IconFileCertificate,
      },
      { to: routes.networth.settings, label: 'Settings', Icon: IconSettings },
    ],
  },
  {
    key: 'quotes',
    label: 'Quotes',
    Icon: IconQuote,
    base: routes.quotes.base,
    description: 'Favourite quotes — daily Zen',
    tabs: [
      { to: routes.quotes.zen, label: 'Zen', Icon: IconSparkles, end: true },
      { to: routes.quotes.library, label: 'Library', Icon: IconList },
      { to: routes.quotes.entry, label: 'New Quote', Icon: IconQuote },
      { to: routes.quotes.settings, label: 'Settings', Icon: IconSettings },
    ],
  },
  {
    key: 'literature',
    label: 'Literature',
    Icon: IconFeather,
    base: routes.literature.base,
    description: 'Chinese poems & prose (粵/國)',
    tabs: [
      { to: routes.literature.home, label: 'Poems', Icon: IconList, end: true },
      { to: routes.literature.poets, label: 'Poets', Icon: IconUsers },
      { to: routes.literature.favorites, label: 'Favorites', Icon: IconHeart },
      { to: routes.literature.settings, label: 'Settings', Icon: IconSettings },
    ],
  },
  {
    key: 'shows',
    label: 'Shows',
    Icon: IconDeviceTv,
    base: routes.shows.base,
    description: 'TV shows & movies',
    tabs: [
      { to: routes.shows.dashboard, label: 'Dashboard', Icon: IconChartBar, end: true },
      { to: routes.shows.library, label: 'Library', Icon: IconList },
      { to: routes.shows.entry, label: 'New Show', Icon: IconDeviceTv },
      { to: routes.shows.settings, label: 'Settings', Icon: IconSettings },
    ],
  },
  {
    key: 'books',
    label: 'Books',
    Icon: IconBook,
    base: routes.books.base,
    description: 'Books read & to read',
    tabs: [
      { to: routes.books.dashboard, label: 'Dashboard', Icon: IconChartBar, end: true },
      { to: routes.books.library, label: 'Library', Icon: IconList },
      { to: routes.books.entry, label: 'New Book', Icon: IconBook },
      { to: routes.books.settings, label: 'Settings', Icon: IconSettings },
    ],
  },
  {
    key: 'travel',
    label: 'Travel',
    Icon: IconWorld,
    base: routes.travel.base,
    description: 'Trips, places & spend',
    tabs: [
      { to: routes.travel.dashboard, label: 'Dashboard', Icon: IconChartBar, end: true },
      { to: routes.travel.map, label: 'Map', Icon: IconMap },
      { to: routes.travel.trips, label: 'Trips', Icon: IconList },
      { to: routes.travel.entry, label: 'New Trip', Icon: IconWorld },
      { to: routes.travel.settings, label: 'Settings', Icon: IconSettings },
    ],
  },
  {
    key: 'medical',
    label: 'Medical',
    Icon: IconHeartbeat,
    base: routes.medical.base,
    description: 'Lab results & reports',
    tabs: [
      { to: routes.medical.dashboard, label: 'Dashboard', Icon: IconChartBar, end: true },
      { to: routes.medical.reports, label: 'Reports', Icon: IconReportMedical },
      { to: routes.medical.entry, label: 'New Medical', Icon: IconHeartbeat },
      { to: routes.medical.settings, label: 'Settings', Icon: IconSettings },
    ],
  },
]

/** The module that owns a pathname, or null for hub/global-settings/login. */
export function moduleForPath(pathname: string): ModuleDef | null {
  return (
    MODULES.find((m) => pathname === m.base || pathname.startsWith(`${m.base}/`)) ?? null
  )
}
