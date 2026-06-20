import { useSyncExternalStore } from 'react'

/**
 * Quotes' app-wide "data changed" tick — separate from `diary-refresh` / `networth-refresh` /
 * `shows-refresh` / `books-refresh` so the modules don't cross-invalidate. Entry CREATE/SAVE and
 * Library delete call `bumpQuotes()`; the Library (and later Zen) include the version in their fetch
 * deps and refetch.
 */
let version = 0
const listeners = new Set<() => void>()

export function bumpQuotes(): void {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useQuotesVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
