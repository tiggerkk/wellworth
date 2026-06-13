import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'
import { Splash } from '../components/Splash'

/** Route gate: waits for the session to resolve, then redirects to /login when there
 * is none, otherwise renders the protected app via <Outlet/>. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
