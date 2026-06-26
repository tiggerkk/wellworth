import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * `useState` drop-in that persists its value in `sessionStorage` under `key`, so it survives the
 * unmount when a list screen navigates into an item and back (and any same-session re-entry), but
 * clears when the tab/app is closed. Resilient to disabled storage (private mode) like
 * `src/lib/last-module.ts`: any read/write failure is swallowed and falls back to `initial`.
 *
 * Schema-drift guard: when both `initial` and the stored value are plain objects, the stored value
 * is shallow-merged over `initial`, so a field added to the default later falls back to its default
 * instead of `undefined`.
 */
export function useSessionState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw === null) return initial
      const parsed = JSON.parse(raw) as T
      if (isPlainObject(initial) && isPlainObject(parsed)) {
        return { ...initial, ...parsed } as T
      }
      return parsed
    } catch {
      return initial // storage disabled or corrupt value
    }
  })

  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setState((prev) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          sessionStorage.setItem(key, JSON.stringify(value))
        } catch {
          // ignore — persisting list state is a convenience, not essential
        }
        return value
      })
    },
    [key],
  )

  return [state, set]
}
