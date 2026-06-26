/**
 * Lazy, accurate Chinese conversion via opencc-js. Unlike the sync `foldZh` (which only folds
 * Traditional → Simplified for search keys), this does phrase-aware conversion in either
 * direction and is used where accuracy matters:
 *   - remote-API search: generate the opposite-variant query (Simplified ⇄ HK-Traditional)
 *     so a CJK search hits external catalogues stored in either script;
 *   - (future) the Settings Traditional/Simplified display toggle.
 *
 * The opencc-js dictionaries (~1MB) are dynamically imported, so they land in their own chunk
 * and only enter memory on first use — never on app start and never on the local-filter
 * keystroke path. The chunk is excluded from the PWA precache (see vite config), mirroring the
 * vendored Travel GeoJSON.
 *
 * `'hk'` (Hong Kong Traditional) is the project's Traditional locale, not `'tw'`.
 */

/** Conversion target: Simplified, or Hong-Kong Traditional. */
export type ZhTarget = 'cn' | 'hk'

// OpenCC needs a (from, to) pair. We don't know the source script of arbitrary text, but
// OpenCC is idempotent when applied to text already in the target script, so picking the
// opposite locale as the source converts cross-script text and leaves same-script text intact.
const FROM_FOR: Record<ZhTarget, 'cn' | 'hk'> = { cn: 'hk', hk: 'cn' }

type Convert = (text: string) => string

let modulePromise: Promise<typeof import('opencc-js')> | null = null
const converters: Partial<Record<ZhTarget, Convert>> = {}

async function getConverter(target: ZhTarget): Promise<Convert> {
  const cached = converters[target]
  if (cached) return cached
  if (!modulePromise) modulePromise = import('opencc-js')
  const OpenCC = await modulePromise
  const convert =
    converters[target] ?? OpenCC.Converter({ from: FROM_FOR[target], to: target })
  converters[target] = convert
  return convert
}

/** Convert `text` to the given Chinese variant (lazy-loads opencc-js on first call). */
export async function convertZh(text: string, target: ZhTarget): Promise<string> {
  if (!text) return text
  const convert = await getConverter(target)
  return convert(text)
}
