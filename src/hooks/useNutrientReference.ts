import { useCallback, useMemo } from 'react'
import { getAllNutrients } from '../data/nutrient'
import { useAsync } from './useAsync'
import type { Tables } from '../types/database'

/** The nutrient reference table + a key→row lookup for labels/units/ordering. */
export function useNutrientReference() {
  const fn = useCallback(() => getAllNutrients(), [])
  const { data, loading, error } = useAsync(fn)

  const byKey = useMemo(() => {
    const map = new Map<string, Tables<'nutrient'>>()
    for (const row of data ?? []) map.set(row.key, row)
    return map
  }, [data])

  return { nutrients: data, byKey, loading, error }
}
