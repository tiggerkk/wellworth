import { useLocation, useOutlet, type Location } from 'react-router'
import { BottomNav } from './BottomNav'
import { useAuth } from '../auth/AuthProvider'
import { useEnsureProfile } from '../hooks/useEnsureProfile'
import { Dashboard, Diary, Library, Settings } from '../screens'

// Background-location pattern (data-router): when a sheet route is open, `location.state
// .background` names the tab to keep painted behind it. We render that tab in <main> and
// the matched sheet (the Outlet) as an overlay on top. Without a background (direct nav or
// hard refresh) the matched route renders normally — sheets fall back to standalone.
const TAB_FOR_PATH: Record<string, React.ReactNode> = {
  '/': <Diary />,
  '/dashboard': <Dashboard />,
  '/library': <Library />,
  '/settings': <Settings />,
}

export function AppShell() {
  const { session } = useAuth()
  useEnsureProfile(session)

  const location = useLocation()
  const outlet = useOutlet()
  const background = (location.state as { background?: Location } | null)?.background
  const backgroundTab = background
    ? (TAB_FOR_PATH[background.pathname] ?? <Diary />)
    : null

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-bg">
      <main className="flex-1 overflow-y-auto">
        {background ? backgroundTab : outlet}
      </main>
      <BottomNav />
      {background && outlet}
    </div>
  )
}
