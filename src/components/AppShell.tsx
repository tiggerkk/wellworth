import { Outlet } from 'react-router'
import { BottomNav } from './BottomNav'
import { useAuth } from '../auth/AuthProvider'
import { useEnsureProfile } from '../hooks/useEnsureProfile'

/** Authenticated layout: a mobile-width column with scrollable content and the bottom
 * tab bar. Rendered inside RequireAuth, so the session is always present here. */
export function AppShell() {
  const { session } = useAuth()
  useEnsureProfile(session)

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-bg">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
