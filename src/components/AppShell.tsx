import { useEffect } from 'react'
import { useLocation, useOutlet, type Location } from 'react-router'
import { BottomNav } from './BottomNav'
import { useAuth } from '../auth/AuthProvider'
import { useEnsureProfile } from '../hooks/useEnsureProfile'
import { moduleForPath } from '../constants/modules'
import { setLastModule } from '../lib/last-module'
import {
  BooksDashboard,
  BooksEntry,
  BooksLibrary,
  BooksSettings,
  Dashboard,
  Diary,
  Library,
  NetWorthDashboard,
  NetWorthEntry,
  QuotesEntry,
  QuotesLibrary,
  QuotesSettings,
  QuotesZen,
  Settings,
  ShowsDashboard,
  ShowsEntry,
  ShowsLibrary,
  ShowsSettings,
  WellnessSettings,
} from '../screens'

// Background-location pattern (data-router): when a sheet route is open, `location.state
// .background` names the tab to keep painted behind it. We render that tab in <main> and
// the matched sheet (the Outlet) as an overlay on top. Keyed by the new namespaced paths.
const TAB_FOR_PATH: Record<string, React.ReactNode> = {
  '/wellness': <Diary />,
  '/wellness/dashboard': <Dashboard />,
  '/wellness/library': <Library />,
  '/wellness/settings': <WellnessSettings />,
  '/settings': <Settings />,
  '/networth': <NetWorthDashboard />,
  '/networth/entry': <NetWorthEntry />,
  '/shows': <ShowsDashboard />,
  '/shows/library': <ShowsLibrary />,
  '/shows/entry': <ShowsEntry />,
  '/shows/settings': <ShowsSettings />,
  '/books': <BooksDashboard />,
  '/books/library': <BooksLibrary />,
  '/books/entry': <BooksEntry />,
  '/books/settings': <BooksSettings />,
  '/quotes': <QuotesZen />,
  '/quotes/library': <QuotesLibrary />,
  '/quotes/entry': <QuotesEntry />,
  '/quotes/settings': <QuotesSettings />,
}

export function AppShell() {
  const { session } = useAuth()
  useEnsureProfile(session)

  const location = useLocation()
  const outlet = useOutlet()
  const module = moduleForPath(location.pathname)

  // Reopen the last-used module on next launch (Home hub + global settings are not modules).
  useEffect(() => {
    if (module) setLastModule(module.key)
  }, [module])

  const background = (location.state as { background?: Location } | null)?.background
  const backgroundTab = background ? (TAB_FOR_PATH[background.pathname] ?? null) : null

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-bg pt-[env(safe-area-inset-top)]">
      <main className="flex-1 overflow-y-auto">
        {background ? backgroundTab : outlet}
      </main>
      {module && <BottomNav module={module} />}
      {background && outlet}
    </div>
  )
}
