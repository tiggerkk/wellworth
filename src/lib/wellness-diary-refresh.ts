import { useSyncExternalStore } from 'react'

/**
 * Tiny pub/sub so a sheet (Food Detail / Activity Log) can tell the Diary tab — which stays
 * mounted behind the sheet — to refetch after logging. Diary includes the version in its
 * fetch deps; mutations call bumpDiary().
 */
let version = 0
const listeners = new Set<() => void>()

export function bumpDiary(): void {
  version += 1
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDiaryVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
