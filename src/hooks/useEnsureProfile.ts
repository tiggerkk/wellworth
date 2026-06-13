import { useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ensureOwnerProfile } from '../data/profile'
import { ensureOwnerActivities } from '../data/activity'

/**
 * On first login, seed the owner's profile and starter activity library. Runs once per
 * user id (the ref guard survives React StrictMode's double-invoke); both ensure-functions
 * are themselves idempotent (no-op when the data already exists) as a second line of defense.
 */
export function useEnsureProfile(session: Session | null): void {
  const ensuredFor = useRef<string | null>(null)

  useEffect(() => {
    const userId = session?.user.id
    if (!userId || ensuredFor.current === userId) return
    ensuredFor.current = userId

    Promise.all([ensureOwnerProfile(userId), ensureOwnerActivities(userId)]).catch(
      (err: unknown) => {
        // Reset so a transient failure can retry on the next render/session change.
        ensuredFor.current = null
        console.error('Failed to seed first-run data', err)
      },
    )
  }, [session])
}
