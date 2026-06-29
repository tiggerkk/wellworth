/**
 * Generic `localStorage`-backed cache of resolved external-API matches for the CSV importers, so
 * re-importing the **same** file (the common case when truncating a table / `supabase db reset
 * --linked` to re-test) skips the network on a hit. Each importer creates one instance with its own
 * storage key + key function; see `book-match-cache.ts` (Google Books) and `show-match-cache.ts`
 * (TMDB).
 *
 * Design notes shared by every instance:
 * - One `localStorage` key per cache (a versioned `{ version, entries }` blob), so the owner can
 *   delete just that key in DevTools, or clear it from the module's Settings, without logging out
 *   (the auth token is a separate key). It is **independent of the database** — a DB reset never
 *   clears it. See `OWNER_RUNBOOK.md` Part R.
 * - Only **positive** matches should be stored by callers; no-match / timeout / quota-aborted rows
 *   re-query next run.
 * - `set` is a synchronous read-merge-write so concurrent importer workers (which await the network
 *   *between* calls, never *inside* one) can't clobber each other's entries. A quota-exceeded write
 *   resets the cache to the one entry, keeping it bounded and usable.
 * - Every read tolerates disabled storage / corrupt JSON / a stale version by yielding an empty
 *   cache rather than throwing.
 */

interface CacheBlob<V> {
  version: number
  entries: Record<string, V>
}

export interface MatchCache<I, V> {
  /** The canonical key for an input (exposed for tests/debugging). */
  key(input: I): string
  /** A previously-cached value for the input, or null on a miss. */
  get(input: I): V | null
  /** Store (or overwrite) the value for the input. */
  set(input: I, value: V): void
  /** Forget a single entry (e.g. a match the owner rejected). */
  remove(input: I): void
  /** Number of cached entries (for a Settings button label). */
  size(): number
  /** Drop the whole cache. */
  clear(): void
}

export function createMatchCache<I, V>(config: {
  storageKey: string
  version: number
  keyFn: (input: I) => string
}): MatchCache<I, V> {
  const { storageKey, version, keyFn } = config

  function read(): CacheBlob<V> {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return { version, entries: {} }
      const blob = JSON.parse(raw) as Partial<CacheBlob<V>>
      if (blob.version !== version || !blob.entries || typeof blob.entries !== 'object') {
        return { version, entries: {} }
      }
      return { version, entries: blob.entries as Record<string, V> }
    } catch {
      return { version, entries: {} }
    }
  }

  function write(blob: CacheBlob<V>): void {
    localStorage.setItem(storageKey, JSON.stringify(blob))
  }

  return {
    key: keyFn,
    get: (input) => read().entries[keyFn(input)] ?? null,
    set: (input, value) => {
      const k = keyFn(input)
      const blob = read()
      blob.entries[k] = value
      try {
        write(blob)
      } catch {
        try {
          write({ version, entries: { [k]: value } })
        } catch {
          // storage disabled — caching is a convenience, so give up silently
        }
      }
    },
    remove: (input) => {
      const k = keyFn(input)
      const blob = read()
      if (k in blob.entries) {
        delete blob.entries[k]
        try {
          write(blob)
        } catch {
          // failing to shrink the cache is harmless
        }
      }
    },
    size: () => Object.keys(read().entries).length,
    clear: () => {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // ignore
      }
    },
  }
}
