import { useSyncExternalStore } from 'react'

/**
 * Medical's app-wide "data changed" tick — separate from the other modules' ticks so they don't
 * cross-invalidate. The Add/Edit Report form (CREATE/SAVE) and the Reports list (delete) call
 * `bumpMedical()`; the list, Report detail, and (M4) Dashboard include the version in their fetch
 * deps and refetch. Mirrors `src/lib/shows-refresh.ts`.
 */
let version = 0
const listeners = new Set<() => void>()

export function bumpMedical(): void {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useMedicalVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
