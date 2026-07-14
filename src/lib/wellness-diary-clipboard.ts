import { useSyncExternalStore } from 'react'
import type { Tables } from '../types/database'

/**
 * In-memory clipboard for the Diary's group/day Copy → Paste flow. Holds copied entries (plus any
 * strength_set children, and each entry's own `group_name`) so they can be pasted into any group or
 * day. A group-level Paste retargets every item to the clicked group; a day-level Paste keeps each
 * entry's original group. Paste is *one-shot* — the caller clears the clipboard (sets it to null)
 * after a successful paste. Lives at module scope so it survives the Diary remounting behind a
 * sheet; it's intentionally not persisted across reloads.
 */
export interface DiaryClipboard {
  /** Day the entries were copied from — used only for the "Copied …" toast label. */
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
