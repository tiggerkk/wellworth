import { useMemo } from 'react'

/**
 * Whether an editable draft differs from its baseline, by deep value (structural) comparison via
 * `JSON.stringify`. Shared by the entry forms to drive Reset/Save enablement. Memoized on the two
 * references, so it only re-serializes when `current` or `initial` actually changes identity.
 */
export function useDirty(current: unknown, initial: unknown): boolean {
  return useMemo(
    () => JSON.stringify(current) !== JSON.stringify(initial),
    [current, initial],
  )
}
