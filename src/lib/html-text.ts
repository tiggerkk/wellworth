/** Convert HTML-ish text from external APIs (TMDB, Google Books, etc.) into plain,
 * readable text: strips tags, turns <br>/<p>/<div> boundaries into line breaks,
 * and normalizes whitespace. Also safe to use on plain text with literal `\n`
 * escapes, since those pass through untouched. */
export function htmlToText(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export type IntroSection = { heading: string; body: string }

/** Some poet bios are stored as a JSON-encoded object of named sections
 * (e.g. `{"軼事典故":"...","洛神悲歌":"..."}`) rather than plain prose. Detects
 * that shape and returns ordered {heading, body} pairs with each body cleaned
 * via htmlToText. Returns null for plain strings so callers can fall back to
 * rendering the text as-is. */
export function parseSectionedIntro(s: string | null | undefined): IntroSection[] | null {
  const trimmed = (s ?? '').trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed as Record<string, unknown>).length === 0
  ) {
    return null
  }

  const entries = Object.entries(parsed as Record<string, unknown>)
  if (!entries.every(([, v]) => typeof v === 'string')) return null

  return entries.map(([heading, body]) => ({ heading, body: htmlToText(body as string) }))
}
