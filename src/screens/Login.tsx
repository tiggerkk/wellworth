import { useState } from 'react'
import { Navigate } from 'react-router'
import { IconBrandGoogle } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { PrimaryButton } from '../components/PrimaryButton'
import { BrandMark } from '../components/BrandMark'
import { Splash } from '../components/Splash'

export function Login() {
  const { session, loading, deniedEmail, authError } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <Splash />
  if (session) return <Navigate to="/" replace />

  async function signIn() {
    setSigningIn(true)
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    // On success the browser redirects to Google, so we only reach here on failure.
    if (oauthError) {
      setError(oauthError.message)
      setSigningIn(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-bg px-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <BrandMark className="size-16 text-accent" />
        <h1 className="text-2xl font-medium text-text-primary">WellWorth</h1>
        <p className="text-body text-text-secondary">
          Track wellness, net-worth, shows, books, quote, medical reports and travel.
        </p>
      </div>

      <PrimaryButton onClick={signIn} disabled={signingIn}>
        <IconBrandGoogle size={18} stroke={2} />
        {signingIn ? 'Connecting…' : 'Sign in with Google'}
      </PrimaryButton>

      {deniedEmail && (
        <p className="text-caption text-danger">
          {deniedEmail} isn’t authorized to use this app. Sign in with an approved
          account.
        </p>
      )}
      {authError && <p className="text-caption text-danger">{authError}</p>}
      {error && <p className="text-caption text-danger">{error}</p>}
    </div>
  )
}
