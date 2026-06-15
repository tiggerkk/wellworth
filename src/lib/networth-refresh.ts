import { useSyncExternalStore } from 'react'

/**
 * Net Worth's app-wide "data changed" tick — separate from `diary-refresh` so the two modules
 * don't cross-invalidate. The Monthly Entry SAVE calls `bumpNetWorth()`; the Dashboard (M5)
 * includes the version in its fetch deps and refetches.
 */
let version = 0
const listeners = new Set<() => void>()

export function bumpNetWorth(): void {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useNetWorthVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
