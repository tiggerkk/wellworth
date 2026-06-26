/**
 * Variant-agnostic search normalization. WellWorth stores Chinese exactly as the user typed
 * it (a mix of Traditional and Simplified), so a naive `.toLowerCase().includes()` filter
 * misses the other variant. `foldZh` folds every Traditional character to its Simplified form
 * (via the generated {@link ZH_FOLD_MAP}) and lowercases, giving one canonical key. Folding
 * BOTH the query and the row text means either input variant matches either stored variant.
 *
 * This is the synchronous, always-resident path used by every local library filter — it must
 * not pull in the ~1MB opencc-js dictionary (that is lazy-loaded in `zh-convert.ts`, only for
 * remote-API query generation and the Settings display toggle).
 */
import { ZH_FOLD_MAP } from '../constants/zh-fold-map'

export { containsCjk } from './cjk'

/** Lowercase and fold Traditional → Simplified for variant-agnostic matching. */
export function foldZh(text: string): string {
  let out = ''
  // for..of iterates by code point, so astral characters fold/pass through intact.
  for (const ch of text) out += ZH_FOLD_MAP[ch] ?? ch
  return out.toLowerCase()
}
