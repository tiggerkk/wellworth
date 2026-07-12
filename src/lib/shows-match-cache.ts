import type { ShowMetadata } from './shows-tmdb-api'
import { normMatch } from './title-match'
import type { ShowType } from '../constants/shows'
import { createMatchCache } from './match-cache'

/**
 * Browser-side cache of resolved TMDB matches for the Shows CSV importer. TMDB has no per-day quota,
 * so this is a **performance** aid (re-importing the same file after a DB reset skips the network and
 * resolves instantly) rather than a quota guard like the Books cache.
 *
 * Keyed on `type | normMatch(title) | year` — the **type** matters (a movie and a TV show can share a
 * title) and the year disambiguates remakes; the title is normalized (Trad→Simp + case/space) and the
 * trailing `(YYYY)` is parsed off by the caller (`parseTitleYear`) before keying. Only **positive**
 * matches are stored; "Change" overwrites, "Manual" removes. See `match-cache.ts` for shared
 * semantics and `OWNER_RUNBOOK.md` Part R for clearing.
 */
interface ShowKey {
  type: ShowType
  title: string
  year: number | null
}

const cache = createMatchCache<ShowKey, ShowMetadata>({
  storageKey: 'wellworth:shows-match-cache',
  version: 1,
  keyFn: ({ type, title, year }) => `${type}|${normMatch(title)}|${year ?? ''}`,
})

/** Canonical cache key for a parsed show row — `type|normMatch(title)|year`. Pure. */
export function showMatchKey(type: ShowType, title: string, year: number | null): string {
  return cache.key({ type, title, year })
}

export function getCachedShowMatch(
  type: ShowType,
  title: string,
  year: number | null,
): ShowMetadata | null {
  return cache.get({ type, title, year })
}

export function setCachedShowMatch(
  type: ShowType,
  title: string,
  year: number | null,
  match: ShowMetadata,
): void {
  cache.set({ type, title, year }, match)
}

export function removeCachedShowMatch(
  type: ShowType,
  title: string,
  year: number | null,
): void {
  cache.remove({ type, title, year })
}

export function showMatchCacheSize(): number {
  return cache.size()
}

export function clearShowMatchCache(): void {
  cache.clear()
}
