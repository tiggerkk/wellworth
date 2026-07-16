import { useCallback } from 'react'

interface UseEntryFavoriteOptions {
  /** Existing record id; undefined for a not-yet-created draft. */
  id: string | undefined
  /** Current favorite value as shown in the draft. */
  favorite: boolean
  /** Patches the draft (e.g. `update({ is_favorite: next })`). */
  setFavorite: (next: boolean) => void
  /** Syncs the dirty baseline after an immediate save, so the flip doesn't count as unsaved and
   *  isn't undone by Reset. */
  syncInitialFavorite: (next: boolean) => void
  /** Persists just the favorite flag for an existing record. */
  persist: (id: string, next: boolean) => Promise<void>
  /** Refreshes the list screen's cache so the change shows immediately (favorite affects list
   *  sort/filter). */
  bump: () => void
}

/**
 * Shared "tap to favorite" behavior for entry forms where the favorite flag lives on the same row
 * being edited (Books/Shows/Quotes) — unlike Wellness's food favorite, which lives on a separate
 * cached `food` entity. Flips the draft immediately; if editing an existing record, also persists
 * right away and syncs the dirty baseline so Reset/Save aren't affected by the flip. For a
 * brand-new, unsaved record there's nothing to persist yet — the value goes out with Create.
 */
export function useEntryFavorite({
  id,
  favorite,
  setFavorite,
  syncInitialFavorite,
  persist,
  bump,
}: UseEntryFavoriteOptions): () => void {
  return useCallback(() => {
    const next = !favorite
    setFavorite(next)
    if (!id) return
    void (async () => {
      await persist(id, next)
      syncInitialFavorite(next)
      bump()
    })()
  }, [id, favorite, setFavorite, syncInitialFavorite, persist, bump])
}
