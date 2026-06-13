/** Full-screen loading state shown while the auth session resolves (and during the
 * OAuth code exchange), so the app never flashes the login screen. */
export function Splash() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-bg">
      <span className="text-sm text-text-secondary">Loading…</span>
    </div>
  )
}
