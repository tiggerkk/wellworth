import { useCallback, useMemo } from 'react'
import { fetchNutrientsCached, getCachedNutrients } from '../lib/nutrient-reference-cache'
import { useAsync } from './useAsync'
import type { Tables } from '../types/database'

/**
 * The nutrient reference table + a key→row lookup for labels/units/ordering. Backed by a
 * session-scoped cache (see `lib/nutrient-reference-cache.ts`) since this reference table is
 * static — only the first of this hook's many call sites per session hits the network; the rest
 * seed instantly from the cached array via `useAsync`'s `initialData`.
 */
export function useNutrientReference() {
  const fn = useCallback(() => fetchNutrientsCached(), [])
  const { data, loading, error } = useAsync(fn, getCachedNutrients())

  const byKey = useMemo(() => {
    const map = new Map<string, Tables<'nutrient'>>()
    for (const row of data ?? []) map.set(row.key, row)
    return map
  }, [data])

  return { nutrients: data, byKey, loading, error }
}
