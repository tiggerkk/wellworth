import { getAllNutrients } from '../data/nutrient'
import type { Tables } from '../types/database'

/**
 * Session-scoped cache for the nutrient reference table (seeded once by
 * `02_wellness_seed_nutrient.sql` and never written to by the app). `useNutrientReference` is
 * called from seven different screens — Dashboard, Daily Report, Diary, Food Detail, Food New,
 * Visible/Highlighted Nutrients settings, and Food Import — each mounting independently. Without
 * this cache every one of those mounts re-queries the same static table; with it, only the first
 * mount per session hits the network and the rest read the resolved array synchronously.
 */
let resolved: Tables<'nutrient'>[] | undefined
let inFlight: Promise<Tables<'nutrient'>[]> | null = null

/** Synchronously available once the first fetch has resolved — used to seed `useAsync`'s `initialData`. */
export function getCachedNutrients(): Tables<'nutrient'>[] | undefined {
  return resolved
}

/** Fetch the nutrient reference table, reusing the resolved value or an in-flight request. */
export function fetchNutrientsCached(): Promise<Tables<'nutrient'>[]> {
  if (resolved) return Promise.resolve(resolved)
  inFlight ??= getAllNutrients()
    .then((rows) => {
      resolved = rows
      return rows
    })
    .catch((err: unknown) => {
      inFlight = null // let the next caller retry after a transient failure
      throw err
    })
  return inFlight
}
