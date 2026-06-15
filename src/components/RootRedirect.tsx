import { Navigate } from 'react-router'
import { getLastModuleBase } from '../lib/last-module'
import { routes } from '../constants/routes'

/**
 * The index route (`/`): send the user to their last-used module, falling back to
 * the Home hub on first run. Login and the PWA `start_url`/OAuth redirect all land on
 * `/` and flow through here.
 */
export function RootRedirect() {
  return <Navigate to={getLastModuleBase() ?? routes.home} replace />
}
