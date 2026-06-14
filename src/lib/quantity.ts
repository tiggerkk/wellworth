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
