/**
 * Best human-readable message from any thrown value, for surfacing in a UI error string.
 *
 * Supabase resolves a failed query to a `PostgrestError`-shaped object (`{ message, details, hint,
 * code }`). Our data layer rethrows that object as-is (`if (error) throw error`), NOT a constructed
 * `Error` — so `e instanceof Error` is false and a plain `e.message` read is skipped. Callers that
 * did `e instanceof Error ? e.message : 'Import failed.'` therefore swallowed the real cause behind a
 * generic fallback. This recognises the Postgrest shape and appends its diagnostic `code`/`hint`/
 * `details` (Postgres often puts the actionable fix in `hint` — e.g. the exact GRANT for a `42501`),
 * while still returning `.message` for a genuine `Error` and the string itself for a thrown string.
 *
 * `fallback` is used only when nothing usable can be extracted.
 */
interface PostgrestLike {
  message?: unknown
  details?: unknown
  hint?: unknown
  code?: unknown
}

export function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'string') return e.trim() || fallback

  const o: PostgrestLike = typeof e === 'object' && e !== null ? (e as PostgrestLike) : {}
  const message = typeof o.message === 'string' ? o.message.trim() : ''
  if (!message) return fallback

  const code = typeof o.code === 'string' && o.code ? `[${o.code}]` : ''
  const hint = typeof o.hint === 'string' ? o.hint.trim() : ''
  const details = typeof o.details === 'string' ? o.details.trim() : ''
  // `hint` is the most actionable field; fall back to `details` when there's no hint.
  const tail = [code, hint || details].filter(Boolean).join(' ')
  return tail ? `${message} ${tail}` : message
}
