import { useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ensureOwnerProfile } from '../data/profile'
import { ensureOwnerActivities } from '../data/activity'
import { bumpDiary } from '../lib/wellness-diary-refresh'

/**
 * On first login, seed the user's profile and starter activity library. Runs once per
 * user id (the ref guard survives React StrictMode's double-invoke); both ensure-functions
 * are themselves idempotent (no-op when the data already exists) as a second line of defense.
 * The email drives owner-vs-member seeding (see ensureOwnerProfile).
 */
export function useEnsureProfile(session: Session | null): void {
  const ensuredFor = useRef<string | null>(null)

  useEffect(() => {
    const userId = session?.user.id
    if (!userId || ensuredFor.current === userId) return
    ensuredFor.current = userId

    const email = session?.user.email
    Promise.all([ensureOwnerProfile(userId, email), ensureOwnerActivities(userId)])
      .then(([createdProfile]) => {
        // A freshly created profile must refresh the onboarding gate (which is showing a splash
        // while getProfile returns null) so it can read the new row and decide owner vs wizard.
        if (createdProfile) bumpDiary()
      })
      .catch((err: unknown) => {
        // Reset so a transient failure can retry on the next render/session change.
        ensuredFor.current = null
        console.error('Failed to seed first-run data', err)
      })
  }, [session])
}
