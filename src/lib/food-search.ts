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

/**
 * The food importer's status for a row from its best USDA hit's `foodMatchScore`:
 *   ok      — exact / leading-word-exact name (score ≥ 4): confident, auto-accept
 *   review  — weaker partial match (score 1–3): needs a glance
 *   nomatch — no usable hit (score 0): import as custom (or fix via Change)
 * Pure.
 */
export function foodMatchStatus(topScore: number): 'ok' | 'review' | 'nomatch' {
  if (topScore >= 4) return 'ok'
  if (topScore >= 1) return 'review'
  return 'nomatch'
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
 *
 * Single-word query:
 *   4  leading word equals the query      ("Blueberries, raw" / "BLUEBERRIES" for "blueberry")
 *   3  leading word starts with the query ("Blueberry juice" for "blueberr")
 *   2  a later word matches the query      ("Muffins, blueberry")
 *   1  the query is inside a word
 *   Exact and leading-prefix deliberately share tier 4 so a bare, nutrient-poor "BLUEBERRIES"
 *   can't outrank the rich "Blueberries, raw" — the caller breaks ties by nutrient count, so
 *   within a tier the more complete food wins.
 *
 * Multi-word query (every typed word must match some name word, else 0):
 *   5  exact full name      — same words, same order & count ("Coffee, Latte" for "coffee latte")
 *   4  leading phrase        — name begins with the typed phrase, then has extra words
 *   2  leading word matches  — the first typed word is the name's lead word (tokens scattered after)
 *   1  tokens present but the lead word doesn't match
 *   Unlike the single-word case, an exact full name is rewarded ABOVE longer variants: a multi-word
 *   query that names the whole food (e.g. a CSV import row, or "Coffee, Latte") should pick that
 *   food, not "Coffee, Iced Latte" or "…without salt" — which otherwise tie at the coarse lead-word
 *   tier and get reordered by nutrient count. ("without" prefix-matches "with", so it still passes
 *   the token gate, but lands at tier 2 below the exact match.)
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

  // Multi-word query: every token must match some name word.
  if (!qWords.every((qw) => nameWords.some((w) => wordMatchLevel(w, qw) > 0))) return 0
  // Do the name's leading words equal the typed phrase, in order? Exact (same length) beats a
  // longer "leading phrase" variant; both beat a mere contains-all-tokens match.
  const leadingExact = qWords.every(
    (qw, i) => wordMatchLevel(nameWords[i] ?? '', qw) === 2,
  )
  if (leadingExact) return qWords.length === nameWords.length ? 5 : 4
  const [firstQ = ''] = qWords
  return wordMatchLevel(lead, firstQ) > 0 ? 2 : 1
}
