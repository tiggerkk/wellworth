/**
 * Variant-agnostic REMOTE search. Local filters can fold both sides to one variant (see
 * `zh-fold.ts`), but an external catalogue (TMDB, Google Books, Nominatim, USDA) holds its data
 * in whatever script it chose and we only control the query string. So for a CJK query we issue
 * it in BOTH scripts — the Simplified fold and the HK-Traditional form — and merge the results.
 * Firing both covers either input direction (type Traditional → its Simplified fold also fires;
 * type Simplified → its HK-Traditional form also fires).
 *
 * Non-CJK queries take the original single-request path and never load opencc-js.
 */
import { containsCjk } from './cjk'
import { foldZh } from './zh-fold'
import { convertZh } from './zh-convert'

/**
 * The distinct script variants to search a remote catalogue with. Non-CJK ⇒ just the trimmed
 * query (no opencc load). CJK ⇒ the original, its Simplified fold, and its HK-Traditional form,
 * de-duplicated (so a same-script query stays a single request).
 */
export async function zhQueryVariants(query: string): Promise<string[]> {
  const q = query.trim()
  if (!q) return []
  if (!containsCjk(q)) return [q]
  const traditional = await convertZh(q, 'hk')
  // foldZh lowercases, which is harmless for a remote query and keeps the Set tidy.
  return Array.from(new Set([q, foldZh(q), traditional].filter(Boolean)))
}

/**
 * Run `run` for each script variant of `query` in parallel and merge, de-duplicating by `keyOf`
 * (results from the earlier variant — the user's original script — keep priority/ordering).
 *
 * Single-variant queries call `run` directly so the caller's own error/throw behaviour is
 * unchanged. For multi-variant queries a single failing request is tolerated; only if EVERY
 * variant fails do we rethrow (preserving the error state the UI shows).
 */
export async function searchZhVariants<T>(
  query: string,
  run: (q: string) => Promise<T[]>,
  keyOf: (item: T) => string | number,
): Promise<T[]> {
  const variants = await zhQueryVariants(query)
  const [first] = variants
  if (first === undefined) return []
  if (variants.length === 1) return run(first)

  const settled = await Promise.allSettled(variants.map(run))
  const fulfilled = settled.filter(
    (r): r is PromiseFulfilledResult<T[]> => r.status === 'fulfilled',
  )
  if (fulfilled.length === 0) {
    throw (settled.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason
  }

  const seen = new Set<string | number>()
  const merged: T[] = []
  for (const r of fulfilled) {
    for (const item of r.value) {
      const k = keyOf(item)
      if (seen.has(k)) continue
      seen.add(k)
      merged.push(item)
    }
  }
  return merged
}
