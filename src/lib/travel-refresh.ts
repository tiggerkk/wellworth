import { useSyncExternalStore } from 'react'

/**
 * Travel's app-wide "data changed" tick — separate from the other modules' refresh stores so they
 * don't cross-invalidate (cf. `books-refresh.ts`). Trip/day/stop/expense writes call `bumpTravel()`;
 * the Trips list + Edit Trip include the version in their fetch deps and refetch.
 */
let version = 0
const listeners = new Set<() => void>()

export function bumpTravel(): void {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTravelVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
