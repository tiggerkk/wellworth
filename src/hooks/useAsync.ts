import { useCallback, useEffect, useState } from 'react'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}

/**
 * Runs `fn` and tracks { data, loading, error }, re-running when `fn` changes or `refetch`
 * is called. A per-run `cancelled` flag discards stale results (race-safe — e.g. fast
 * day-arrow tapping) and results that land after unmount, and makes it StrictMode-safe.
 *
 * Pass a STABLE `fn` (wrap the call site in `useCallback` with its own deps) so the effect
 * doesn't re-run every render.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    loading: true,
    error: undefined,
  })
  const [nonce, setNonce] = useState(0)
  const refetch = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    // Intentional: reset to loading whenever fn/nonce changes (a new fetch starts).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: undefined }))
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: undefined })
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
  }, [fn, nonce])

  return { ...state, refetch }
}
