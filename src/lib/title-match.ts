/**
 * Shared, pure title-matching primitives used by both the Google Books client (`books-api.ts`) and
 * the TMDB client (`shows-tmdb-api.ts`) to rank remote search hits and judge importer confidence. Kept
 * free of either domain so both can depend on it without coupling Shows↔Books.
 */
import { foldZh } from './zh-fold'

/**
 * Canonical match key: `foldZh` folds Traditional→Simplified and lowercases (so 紅樓夢 and 红楼梦
 * compare equal); we then strip ALL whitespace, ASCII + CJK punctuation, and symbols, keeping CJK
 * ideographs and alphanumerics. Whitespace is stripped entirely (not collapsed): CJK has no
 * inter-word spaces and catalogues vary on spacing, so `满天星斗：…` and `满天星斗 …` reduce to the
 * same prefix. (An ASCII-only `[^a-z0-9]` normalizer would collapse every CJK title to '' — making
 * every CJK title look like an exact match.)
 */
export function normMatch(text: string): string {
  return foldZh(text).replace(/[\s\p{P}\p{S}]+/gu, '')
}

/** Title overlap, strongest first: 3 exact · 2 prefix (either direction) · 1 contains · 0 none. */
export function titleTier(resultTitle: string, target: string): 0 | 1 | 2 | 3 {
  const q = normMatch(target)
  if (!q) return 0
  const t = normMatch(resultTitle)
  if (t === q) return 3
  // Bidirectional prefix: catalogue may add or omit a subtitle/suffix the query doesn't carry.
  if (t.startsWith(q) || q.startsWith(t)) return 2
  if (t.includes(q)) return 1
  return 0
}
