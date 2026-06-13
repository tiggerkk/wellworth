import { useCallback } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getProfile } from '../data/profile'
import { useDiaryVersion } from '../lib/diary-refresh'
import { useAsync } from './useAsync'

/**
 * The signed-in user's profile. Refetches on the shared user-data tick, so a Settings
 * edit (which bumps it) propagates to the Diary/Dashboard targets and units.
 */
export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useDiaryVersion()
  const fn = useCallback(() => {
    if (!userId) throw new Error('Not signed in')
    void version // refetch when user data changes
    return getProfile(userId)
  }, [userId, version])
  return useAsync(fn)
}
