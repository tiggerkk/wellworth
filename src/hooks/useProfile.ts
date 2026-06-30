import { useCallback, useMemo } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getProfile } from '../data/profile'
import { useDiaryVersion } from '../lib/diary-refresh'
import { getCachedProfile, setCachedProfile } from '../lib/profile-cache'
import { useAsync } from './useAsync'

/**
 * The signed-in user's profile. Refetches on the shared user-data tick, so a Settings
 * edit (which bumps it) propagates to the Diary/Dashboard targets and units.
 *
 * By default the first render is seeded from a local cache of the last-known profile, so screens that
 * render a per-profile order/visibility (Home hub, Medical/Net Worth ordering) paint the user's choice
 * immediately instead of flashing the canonical default while the fetch is in flight. Every fetch
 * refreshes that cache (sanitized — see `profile-cache.ts`).
 *
 * Pass `{ seed: false }` where the seed must not apply: editors that copy the profile into local state
 * on mount (they need the authoritative fresh row, not a possibly-stale cache — see `useProfileEditor`)
 * and the Medical lock (the cache strips its PIN hash; it gates via its own synchronous hint instead).
 */
export function useProfile({ seed = true }: { seed?: boolean } = {}) {
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useDiaryVersion()
  const fn = useCallback(async () => {
    if (!userId) throw new Error('Not signed in')
    void version // refetch when user data changes
    const profile = await getProfile(userId)
    setCachedProfile(userId, profile)
    return profile
  }, [userId, version])
  const initialData = useMemo(
    () => (seed && userId ? getCachedProfile(userId) : undefined),
    [seed, userId],
  )
  return useAsync(fn, initialData)
}
