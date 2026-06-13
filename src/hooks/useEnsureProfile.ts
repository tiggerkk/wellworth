import { useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ensureOwnerProfile } from '../data/profile'

/**
 * Ensures the signed-in user has a profile row, seeding the owner's defaults on first
 * login. Runs once per user id (the ref guard survives React StrictMode's double-invoke);
 * ensureOwnerProfile is itself idempotent as a second line of defense.
 */
export function useEnsureProfile(session: Session | null): void {
  const ensuredFor = useRef<string | null>(null)

  useEffect(() => {
    const userId = session?.user.id
    if (!userId || ensuredFor.current === userId) return
    ensuredFor.current = userId

    ensureOwnerProfile(userId).catch((err: unknown) => {
      // Reset so a transient failure can retry on the next render/session change.
      ensuredFor.current = null
      console.error('Failed to ensure profile', err)
    })
  }, [session])
}
