/**
 * Pure helpers for the Add-Food search: building the USDA query (so the server returns the right
 * candidates for partial input) and ranking the results by how well each name matches what was
 * typed. Matching is case-, punctuation- and singular/plural-insensitive and tolerant of partial
 * typing, so "bluebe" / "blueberr" / "blueberrie" / "blueberry" / "blueberries" all surface
 * "Blueberries, raw", "Muffins, blueberry", etc.
 */

/** Crude English plural→singular so "blueberries" matches "blueberry". */
export function singularize(word: string): string {
  if (word.length <= 3) return word
  if (/ies$/.test(word)) return word.slice(0, -3) + 'y'
  if (/(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2)
  if (/ss$/.test(word)) return word
  if (/s$/.test(word)) return word.slice(0, -1)
  return word
}

/**
 * Build the USDA `query` for a typed term. USDA matches whole tokens, so a partial word like
 * "blueberr" returns nothing — we give the last (still-being-typed) word a `*` wildcard. The word
 * is first reduced to a stem by dropping a trailing run of inflection/partial letters (s/e/y/i), so
 * "blueberry", "blueberries", "blueberrie" and "blueberr" all become "blueberr*" — a single prefix
 * that USDA expands to every blueberry variant. A too-broad stem is harmless: the result scorer
 * re-filters to what was actually typed. (Earlier words are left as-is; they're already complete.)
 */
export function toUsdaWildcardQuery(term: string): string {
  const tokens = term.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return ''
  const last = tokens[tokens.length - 1] ?? ''
  const stem = last.replace(/[syei]+$/, '')
  tokens[tokens.length - 1] = `${stem.length >= 3 ? stem : last}*`
  return tokens.join(' ')
}

/** Lowercase, strip punctuation, split into words (no singularizing — matching handles that). */
function toWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Match level of a name word `w` against a (possibly still-being-typed) query token `q`:
 * 2 = same word, 1 = prefix, 0 = no match. Compares both the raw and singularized forms so that
 * singular/plural swaps ("blueberry"↔"blueberries"), in-progress plurals ("blueberrie") and
 * straight prefixes ("blueberr") all match — "blueberries" starts with every prefix the user types
 * on the way there. Plain prefix matching (not fuzzy) keeps "rice" from matching "rich".
 */
function wordMatchLevel(w: string, q: string): number {
  if (w === q || singularize(w) === singularize(q)) return 2
  if (w.startsWith(q) || singularize(w).startsWith(singularize(q))) return 1
  return 0
}

/**
 * How well `name` matches `query` (higher = better; 0 = no match, drop it).
 *   4  leading word equals the query      ("Blueberries, raw" / "BLUEBERRIES" for "blueberry")
 *   3  leading word starts with the query ("Blueberry juice" for "blueberr")
 *   2  a later word matches the query      ("Muffins, blueberry")
 *   1  the query is inside a word, or every word of a multi-word query matches
 *
 * Exact and leading-prefix matches deliberately share the top tiers so a bare, nutrient-poor
 * "BLUEBERRIES" can't outrank the rich "Blueberries, raw" — the caller breaks ties by nutrient
 * count, so within a tier the more complete food wins.
 */
export function foodMatchScore(name: string, query: string): number {
  const qWords = toWords(query)
  const nameWords = toWords(name)
  if (qWords.length === 0 || nameWords.length === 0) return 0
  const [lead = ''] = nameWords

  if (qWords.length === 1) {
    const [q = ''] = qWords
    const level = wordMatchLevel(lead, q)
    if (level === 2) return 4
    if (level === 1) return 3
    if (nameWords.slice(1).some((w) => wordMatchLevel(w, q) > 0)) return 2
    if (nameWords.join(' ').includes(q)) return 1
    return 0
  }

  // Multi-word query: every token must match some name word; lead-word match ranks higher.
  if (!qWords.every((qw) => nameWords.some((w) => wordMatchLevel(w, qw) > 0))) return 0
  const [firstQ = ''] = qWords
  return wordMatchLevel(lead, firstQ) > 0 ? 2 : 1
}
