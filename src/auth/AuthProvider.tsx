import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ALLOWED_EMAILS, isEmailAllowed, parseOAuthError } from '../lib/access'

interface AuthState {
  session: Session | null
  loading: boolean
  /** The email of an account that signed in but isn't on the allowlist (so Login can explain). */
  deniedEmail: string | null
  /** A human message for an OAuth error the provider returned on the redirect (else null). */
  authError: string | null
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  deniedEmail: null,
  authError: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null)
  // Captured during the first render — before the router navigates and strips the redirect's
  // `?error=…` query — so a failed OAuth sign-in (e.g. sign-ups disabled) explains itself on Login.
  const [authError] = useState<string | null>(() =>
    typeof window === 'undefined'
      ? null
      : parseOAuthError(window.location.search, window.location.hash),
  )

  useEffect(() => {
    // Apply a session only if its email passes the allowlist; an off-list account is signed back
    // out immediately and remembered so Login can say why (RLS already isolates data — this just
    // stops strangers creating accounts at all). An empty allowlist allows everyone.
    function apply(next: Session | null) {
      if (next && !isEmailAllowed(next.user.email, ALLOWED_EMAILS)) {
        setDeniedEmail(next.user.email ?? 'this account')
        setSession(null)
        setLoading(false)
        void supabase.auth.signOut()
        return
      }
      if (next) setDeniedEmail(null)
      setSession(next)
      setLoading(false)
    }

    // Resolve any persisted / freshly-exchanged session before deciding what to render.
    void supabase.auth.getSession().then(({ data }) => apply(data.session))

    // Keep in sync with sign-in/out, token refresh, and other tabs. Set state
    // synchronously here — awaiting inside this callback can deadlock the auth lock.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => apply(next))

    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext value={{ session, loading, deniedEmail, authError }}>
      {children}
    </AuthContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return use(AuthContext)
}
