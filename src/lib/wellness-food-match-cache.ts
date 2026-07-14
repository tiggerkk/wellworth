import type { ExternalFood } from './wellness-food-api'
import { normMatch } from './title-match'
import { createMatchCache } from './match-cache'

/**
 * Browser-side cache of resolved USDA matches for the Wellness food CSV importer. USDA has no per-day
 * quota, so this is a **performance** aid: re-importing the same file (e.g. after `supabase db reset
 * --linked` while testing) skips the network and resolves instantly.
 *
 * Keyed on the CSV row's food name via `normMatch` (Trad→Simp fold + case/space strip). Value = the
 * **full** resolved `ExternalFood` (from `getUsdaFood`), so a cache hit needs no search *or* detail
 * fetch. Only **positive** matches are stored; "Change" overwrites, "Manual" removes. See
 * `match-cache.ts` for shared semantics and `OWNER_RUNBOOK.md` Part R for clearing.
 */
const cache = createMatchCache<{ name: string }, ExternalFood>({
  storageKey: 'wellworth:food-match-cache',
  version: 1,
  keyFn: ({ name }) => normMatch(name),
})

/** Canonical cache key for a CSV food row — `normMatch(name)`. Pure. */
export function foodMatchKey(name: string): string {
  return cache.key({ name })
}

export function getCachedFoodMatch(name: string): ExternalFood | null {
  return cache.get({ name })
}

export function setCachedFoodMatch(name: string, match: ExternalFood): void {
  cache.set({ name }, match)
}

export function removeCachedFoodMatch(name: string): void {
  cache.remove({ name })
}

export function foodMatchCacheSize(): number {
  return cache.size()
}

export function clearFoodMatchCache(): void {
  cache.clear()
}
