import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from './useAsync'
import { addFavorite, listFavoriteIds, removeFavorite } from '../data/literature'
import { bumpLiterature, useLiteratureVersion } from '../lib/literature-refresh'

export interface LiteratureFavorites {
  favoriteIds: Set<number>
  loading: boolean
  /** Optimistically toggle a poem's favourite state, persisting in the background. */
  toggle: (poemId: number) => void
}

/**
 * The signed-in user's favourite poem ids + an optimistic toggle, shared by the Home, Poem-detail and
 * Favorites screens. Refetches when the favourites tick bumps (`bumpLiterature`); the optimistic
 * override resets when the real fetch lands (adjust-state-during-render, per tech-spec F16b).
 */
export function useLiteratureFavorites(): LiteratureFavorites {
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useLiteratureVersion()

  const fn = useCallback(() => {
    void version
    if (!userId) return Promise.resolve<number[]>([])
    return listFavoriteIds(userId)
  }, [userId, version])
  const { data, loading } = useAsync(fn)

  const [override, setOverride] = useState<Set<number> | null>(null)
  const [synced, setSynced] = useState(data)
  if (synced !== data) {
    setSynced(data)
    setOverride(null)
  }

  const favoriteIds = useMemo(() => override ?? new Set(data ?? []), [override, data])

  const toggle = useCallback(
    (poemId: number) => {
      if (!userId) return
      const next = new Set(favoriteIds)
      const wasFav = next.has(poemId)
      if (wasFav) next.delete(poemId)
      else next.add(poemId)
      setOverride(next)
      const op = wasFav ? removeFavorite(userId, poemId) : addFavorite(userId, poemId)
      op.catch(() => bumpLiterature()) // resync from server on a failed write
    },
    [userId, favoriteIds],
  )

  return { favoriteIds, loading, toggle }
}
