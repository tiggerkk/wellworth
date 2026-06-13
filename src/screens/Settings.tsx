import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

export function Settings() {
  const { session } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    // RequireAuth redirects to /login once onAuthStateChange clears the session.
    await supabase.auth.signOut()
  }

  return (
    <section className="px-4 py-4">
      <h1 className="text-lg font-medium text-text-primary">Settings</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Profile, targets, and nutrient visibility come in a later milestone.
      </p>

      <div className="mt-6 rounded-card border border-border bg-surface p-4">
        <p className="text-xs uppercase tracking-[0.08em] text-text-secondary">Account</p>
        {session?.user.email && (
          <p className="mt-2 text-sm text-text-muted">{session.user.email}</p>
        )}
        <button
          onClick={signOut}
          disabled={signingOut}
          className="mt-3 text-sm text-accent disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </section>
  )
}
