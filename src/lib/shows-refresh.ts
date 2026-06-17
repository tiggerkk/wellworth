import { useSyncExternalStore } from 'react'

/**
 * Shows' app-wide "data changed" tick — separate from `diary-refresh` / `networth-refresh` so
 * the modules don't cross-invalidate. Entry CREATE/SAVE and Library delete call `bumpShows()`;
 * the Library (and M4 Dashboard) include the version in their fetch deps and refetch.
 */
let version = 0
const listeners = new Set<() => void>()

export function bumpShows(): void {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useShowsVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
