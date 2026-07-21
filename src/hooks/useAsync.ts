import { useCallback, useEffect, useState } from 'react'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}

/** `version` is the caller's module-wide "data changed" counter (e.g. `useShowsVersion()`),
 * which bumps only on a write to that module's table — see e.g. `lib/shows-refresh.ts`. */
interface AsyncCacheOptions {
  key: string
  version: number
}

/**
 * Opt-in shared cache across every `useAsync` call using the same `key` — e.g. a Dashboard and a
 * Library screen that both list the same table. Module-level (not component state) so a value
 * fetched by one screen is still there when the other mounts later in the same session.
 */
const asyncCache = new Map<string, { version: number; data: unknown }>()

/**
 * Runs `fn` and tracks { data, loading, error }, re-running when `fn` changes or `refetch`
 * is called. A per-run `cancelled` flag discards stale results (race-safe — e.g. fast
 * day-arrow tapping) and results that land after unmount, and makes it StrictMode-safe.
 *
 * Pass a STABLE `fn` (wrap the call site in `useCallback` with its own deps) so the effect
 * doesn't re-run every render.
 *
 * Optional `initialData` seeds the first render (stale-while-revalidate): the seeded value paints
 * immediately and `fn` still runs to reconcile. With a seed there's nothing to "load" yet, so initial
 * `loading` is false; the background fetch then runs normally (the effect preserves `data` throughout).
 * Omitting `initialData` is the original behavior exactly.
 *
 * Optional `cache` shares a fetch's result across every `useAsync` call using the same `key`. A hit
 * at the exact same `version` skips the network call entirely — that module hasn't been written to
 * since the cached rows were fetched, so they're still exactly right — instead of independently
 * re-fetching the whole list every time either screen mounts. Takes priority over `initialData`
 * when both are given; a version mismatch (or no entry yet) falls through to a normal fetch, which
 * then populates/refreshes the cache for the next mount.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  initialData?: T,
  cache?: AsyncCacheOptions,
): AsyncState<T> & { refetch: () => void } {
  const cached = cache
    ? (asyncCache.get(cache.key) as { version: number; data: T } | undefined)
    : undefined
  const cacheHit = !!cache && !!cached && cached.version === cache.version
  const seed = cacheHit ? cached!.data : initialData

  const [state, setState] = useState<AsyncState<T>>({
    data: seed,
    loading: seed === undefined,
    error: undefined,
  })
  const [nonce, setNonce] = useState(0)
  const refetch = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    // Exact cache hit for this key+version: reuse without a network call — see cache doc above.
    if (cache) {
      const c = asyncCache.get(cache.key) as { version: number; data: T } | undefined
      if (c && c.version === cache.version) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState({ data: c.data, loading: false, error: undefined })
        return
      }
    }
    let cancelled = false
    // Intentional: reset to loading whenever fn/nonce changes (a new fetch starts).
    setState((s) => ({ ...s, loading: true, error: undefined }))
    fn()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: undefined })
          if (cache) asyncCache.set(cache.key, { version: cache.version, data })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: undefined,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          })
        }
      })
    return () => {
      cancelled = true
    }
    // `cache` is read by its key/version primitives (below) rather than object identity, since
    // call sites pass a fresh object literal each render — see the cache doc above for why a
    // version-scoped hit is safe regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, nonce, cache?.key, cache?.version])

  return { ...state, refetch }
}
