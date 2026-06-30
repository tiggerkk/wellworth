/**
 * Interpret an editable numeric draft from a text field. The field is stored as a string so it
 * can be momentarily empty (cleared on focus); a blank, non-numeric, or negative draft resolves
 * to `fallback` (e.g. Amount → 1, Duration → the activity's default). Used by the logging sheets.
 */
export function draftAmount(raw: string, fallback: number): number {
  const n = Number(raw)
  if (raw.trim() === '' || !Number.isFinite(n) || n < 0) return fallback
  return n
}

/**
 * Render a nullable number as an editable text-field value: the number as a string, or `''` when
 * null. The inverse of reading a number back out of a text input; shared by the entry-form drafts
 * (Shows/Books/Medical) so a cleared field round-trips to/from null consistently.
 */
export const numStr = (n: number | null): string => (n != null ? String(n) : '')
