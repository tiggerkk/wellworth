import { useSyncExternalStore } from 'react'

/**
 * Literature's app-wide "favourites changed" tick — separate from the other modules' refresh ticks so
 * they don't cross-invalidate. Favouriting/un-favouriting a poem calls `bumpLiterature()`; the Home,
 * Poem-detail and Favorites screens include the version in their fetch deps and refetch the favourite
 * set. (The corpus itself is immutable, so only the per-user favourite set is refetched.)
 */
let version = 0
const listeners = new Set<() => void>()

export function bumpLiterature(): void {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLiteratureVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
