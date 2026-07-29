import { useEffect, useState } from 'react'

/**
 * Returns `value`, but only updates to a new value after it has settled for `delayMs` without
 * changing again. Used by the search overlays and pickers to avoid firing an API/DB query on
 * every keystroke — the query only fires once the user pauses typing.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])

  return debounced
}
