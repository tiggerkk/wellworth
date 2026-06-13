import { useCallback } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getProfile } from '../data/profile'
import { useAsync } from './useAsync'

/** The signed-in user's profile (loaded once; refetch after Settings edits). */
export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  const fn = useCallback(() => {
    if (!userId) throw new Error('Not signed in')
    return getProfile(userId)
  }, [userId])
  return useAsync(fn)
}
