import { useSyncExternalStore } from 'react'

/**
 * Journal's app-wide "data changed" tick — separate from `quotes-refresh` / `diary-refresh` /
 * etc. so the modules don't cross-invalidate. Entry CREATE/SAVE/DELETE call `bumpJournal()`; the
 * Journal listing includes the version in its fetch deps and refetches.
 */
let version = 0
const listeners = new Set<() => void>()

export function bumpJournal(): void {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useJournalVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
