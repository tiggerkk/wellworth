export interface ServingDraft {
  /** Stored serving id, when this row came from the DB. Undefined for a not-yet-saved row (a
   *  freshly added serving, or the synthetic "100 g" fallback from `withDefaultServing`). */
  id?: string
  name: string
  grams: number
}

/** Whether a serving row is complete enough to store — a name and a positive gram weight. */
export const isStorable = (s: { name: string; grams: number }): boolean =>
  s.name.trim() !== '' && s.grams > 0

/**
 * Stamps stored ids onto a local serving list after a write. `saved` is in the order of the
 * storable rows (that is what `replaceServings` returns), so the Nth storable row takes the Nth
 * saved id; rows that were not storable stay id-less. Without this the local list keeps the
 * pre-save shape, and the next Manage-servings save sends id-less rows, which delete-and-reinsert
 * them under new ids and null out `diary_entry.serving_id` on everything logged in between.
 */
export function withSavedIds<T extends ServingDraft>(
  list: T[],
  saved: { id: string }[],
): T[] {
  let n = 0
  return list.map((s) => (isStorable(s) ? { ...s, id: saved[n++]?.id ?? s.id } : s))
}
