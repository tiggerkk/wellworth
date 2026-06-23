/**
 * Shared CJK-text detection. The character class covers two ranges: U+3400-U+9FFF
 * (CJK Unified Ideographs + Extension A) and U+F900-U+FAFF (CJK Compatibility Ideographs).
 * Written with the code points as `\u` escapes (not literal boundary glyphs) so it reads unambiguously.
 * Reused by Shows/Books (Dynasty editability), the TMDB client (`tmdbLanguage`), and Quotes
 * (`detectLanguage`).
 */
export function containsCjk(text: string): boolean {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text)
}
