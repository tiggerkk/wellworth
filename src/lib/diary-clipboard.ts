import { useSyncExternalStore } from 'react'
import type { Tables } from '../types/database'

/**
 * In-memory clipboard for the Diary's Multi-Select → Copy → Paste flow. Holds copied entries (plus
 * any strength_set children) so they can be pasted onto a *different* day. Lives at module scope so
 * it survives the Diary remounting behind a sheet; it's intentionally not persisted across reloads.
 */
export interface DiaryClipboard {
  /** Day the entries were copied from; Paste is offered only on a different day. */
  day: string
  entries: Tables<'diary_entry'>[]
  /** strength_set rows for copied strength entries, keyed by source entry id. */
  setsByEntry: Record<string, Tables<'strength_set'>[]>
}

let clipboard: DiaryClipboard | null = null
const listeners = new Set<() => void>()

export function setDiaryClipboard(next: DiaryClipboard | null): void {
  clipboard = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDiaryClipboard(): DiaryClipboard | null {
  return useSyncExternalStore(
    subscribe,
    () => clipboard,
    () => clipboard,
  )
}
