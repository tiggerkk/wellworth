import { useCallback } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from './useProfile'
import { updateProfile } from '../data/profile'
import { bumpDiary } from '../lib/diary-refresh'
import type { Tables, TablesUpdate } from '../types/database'

/**
 * Profile + an auto-save helper for Settings. `save` persists a partial patch then bumps
 * the shared tick, which refetches every `useProfile` consumer (Settings, Diary, Dashboard).
 */
export function useProfileEditor(): {
  profile: Tables<'profile'> | null | undefined
  loading: boolean
  error: Error | undefined
  save: (patch: TablesUpdate<'profile'>) => Promise<void>
} {
  const { session } = useAuth()
  const userId = session?.user.id
  // seed:false — the editor copies the profile into local state on mount, so it must initialize from
  // the authoritative fresh fetch, not a possibly-stale local cache.
  const { data: profile, loading, error } = useProfile({ seed: false })

  const save = useCallback(
    async (patch: TablesUpdate<'profile'>) => {
      if (!userId) return
      await updateProfile(userId, patch)
      bumpDiary()
    },
    [userId],
  )

  return { profile, loading, error, save }
}
