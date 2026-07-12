import type { BookMetadata } from './books-api'
import { normMatch } from './books-api'
import { createMatchCache } from './match-cache'

/**
 * Browser-side cache of resolved Google Books / Open Library matches for the CSV importer, so
 * re-importing the **same** file (e.g. after truncating `book` or `supabase db reset --linked` while
 * testing) skips the network — no per-day quota burn for books already resolved once.
 *
 * Keyed on the CSV row's title + author via `normMatch` (Trad→Simp fold + punctuation/whitespace
 * strip), so 紅樓夢/红楼梦 and case/spacing variants share one entry. Only **positive** matches are
 * stored; a "Change" correction overwrites the entry, "Manual" removes it. See `match-cache.ts` for
 * the shared storage/concurrency semantics and `OWNER_RUNBOOK.md` Part R for how to clear it.
 */
interface BookKey {
  title: string
  author: string | null | undefined
}

const cache = createMatchCache<BookKey, BookMetadata>({
  storageKey: 'wellworth:books-match-cache',
  version: 1,
  keyFn: ({ title, author }) => `${normMatch(title)}|${normMatch(author ?? '')}`,
})

/** Canonical cache key for a CSV row — `normMatch(title)|normMatch(author)`. Pure. */
export function bookMatchKey(title: string, author: string | null | undefined): string {
  return cache.key({ title, author })
}

export function getCachedBookMatch(
  title: string,
  author: string | null | undefined,
): BookMetadata | null {
  return cache.get({ title, author })
}

export function setCachedBookMatch(
  title: string,
  author: string | null | undefined,
  match: BookMetadata,
): void {
  cache.set({ title, author }, match)
}

export function removeCachedBookMatch(
  title: string,
  author: string | null | undefined,
): void {
  cache.remove({ title, author })
}

export function bookMatchCacheSize(): number {
  return cache.size()
}

export function clearBookMatchCache(): void {
  cache.clear()
}
