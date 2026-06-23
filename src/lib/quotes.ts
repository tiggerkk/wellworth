/**
 * Quotes domain helpers — UI-framework-free so they're unit-tested and shared by the Entry form,
 * the Library, and (later) the Zen dashboard + importer. DB access lives in `src/data/quote.ts`;
 * the category/source/language enums + labels live in `src/constants/quotes.ts`.
 */
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'
import type { QuoteLanguage, QuoteSourceType } from '../constants/quotes'

export type QuoteRow = Tables<'quote'>
export type QuoteInsert = TablesInsert<'quote'>
export type QuoteUpdate = TablesUpdate<'quote'>

/**
 * Detect a quote's language from its text: any CJK character ⇒ 'zh', else 'en'. Editable on the
 * form. Ranges: CJK Ext-A (㐀–䶿), Unified (一–鿿), Compatibility Ideographs (豈–﫿).
 */
export function detectLanguage(text: string): QuoteLanguage {
  return /[㐀-鿿豈-﫿]/.test(text) ? 'zh' : 'en'
}

/** Lowercased text the Library search matches: quote text + author + title + tags. */
export function quoteSearchText(
  q: Pick<QuoteRow, 'text' | 'author' | 'title' | 'tags'>,
): string {
  return [q.text, q.author, q.title, ...(q.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * Category-badge palette. A single neutral chip for now (used via the presentational `StatusChip`);
 * a fixed colour per category is optional per the spec and deferred until the Zen badge is prominent.
 */
export const QUOTE_CATEGORY_CHIP = 'bg-input text-text-secondary'

// --- Cross-module Show/Book linker (M3) ---

/**
 * A unified, UI-friendly view of a linkable local record (a Show or a Book) the Entry form can bind
 * to a quote. The screen maps `ShowRow`/`BookRow` → this shape (resolving thumbnails) so this module
 * stays decoupled from `shows.ts`/`books.ts`; the pure search below operates on it.
 */
export interface LinkCandidate {
  kind: 'show' | 'book'
  id: string
  title: string
  year: number | null
  thumbUrl: string | null
  /** 'tv' | 'movie' for a show, 'book' for a book — denormalised onto the quote on select. */
  sourceType: QuoteSourceType
  /** A book's authors (empty for shows). */
  authors: string[]
}

/** Lowercased text the linker search matches: title + (book) authors. */
export function linkSearchText(c: Pick<LinkCandidate, 'title' | 'authors'>): string {
  return [c.title, ...c.authors].filter(Boolean).join(' ').toLowerCase()
}

/** Filter link candidates by a free-text query (title / author substring). Empty query ⇒ all. */
export function filterLinkCandidates(
  candidates: LinkCandidate[],
  query: string,
): LinkCandidate[] {
  const q = query.trim().toLowerCase()
  if (!q) return candidates
  return candidates.filter((c) => linkSearchText(c).includes(q))
}

// --- Moment of Zen selection (M4; randomness injected so the rules are unit-testable) ---

/** First-load pool: the favourites if there are any, otherwise the whole list. */
export function initialZenPool<T extends Pick<QuoteRow, 'is_favorite'>>(
  quotes: T[],
): T[] {
  const favs = quotes.filter((q) => q.is_favorite)
  return favs.length > 0 ? favs : quotes
}

/**
 * Refresh pool: the whole list minus the currently-shown quote (so a refresh never immediately
 * repeats). Degrades to the whole list when that would be empty (a single quote, or no current).
 */
export function nextZenPool<T extends Pick<QuoteRow, 'id'>>(
  quotes: T[],
  currentId: string | null,
): T[] {
  const rest = quotes.filter((q) => q.id !== currentId)
  return rest.length > 0 ? rest : quotes
}

/** Uniformly pick one item (or null when empty). `random` is injectable for deterministic tests. */
export function randomItem<T>(items: T[], random: () => number = Math.random): T | null {
  if (items.length === 0) return null
  return items[Math.floor(random() * items.length)] ?? null
}

// --- Library filtering (M5; pure — the screen holds the criteria state) ---

export interface LibraryCriteria {
  query: string
  /** A configured category key, or 'all' (the values are owner-configurable — see quotes-config.ts). */
  category: 'all' | string
  /** Multi-select tags, OR semantics: a quote matches if it has ANY selected tag. */
  tags: string[]
  favoritesOnly: boolean
  /** A configured source-type key, or 'all'. */
  sourceType: 'all' | string
  language: 'all' | QuoteLanguage
  /** "Quotes from this title" constraint (URL-driven, not a panel control). */
  showId: string | null
  bookId: string | null
}

export const DEFAULT_LIBRARY_CRITERIA: LibraryCriteria = {
  query: '',
  category: 'all',
  tags: [],
  favoritesOnly: false,
  sourceType: 'all',
  language: 'all',
  showId: null,
  bookId: null,
}

/** Sorted distinct tags across the given quotes — the Tags-facet options (derived, no DB call). */
export function quoteTags(quotes: Pick<QuoteRow, 'tags'>[]): string[] {
  const set = new Set<string>()
  for (const q of quotes) for (const t of q.tags ?? []) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/**
 * Filter a Library list. **Filter only** — input order (`updated_at desc` from `listQuotes`) is
 * preserved (the spec has no sort menu). Pure; does not mutate `quotes`.
 */
export function applyLibraryView(quotes: QuoteRow[], c: LibraryCriteria): QuoteRow[] {
  const q = c.query.trim().toLowerCase()
  return quotes.filter((quote) => {
    if (q && !quoteSearchText(quote).includes(q)) return false
    if (c.category !== 'all' && quote.category !== c.category) return false
    if (c.tags.length > 0 && !c.tags.some((t) => quote.tags.includes(t))) return false
    if (c.favoritesOnly && !quote.is_favorite) return false
    if (c.sourceType !== 'all' && quote.source_type !== c.sourceType) return false
    if (c.language !== 'all' && quote.language !== c.language) return false
    if (c.showId && quote.show_id !== c.showId) return false
    if (c.bookId && quote.book_id !== c.bookId) return false
    return true
  })
}

// --- Entry/Edit field visibility (Quotes Settings, M6) ---

/**
 * The Entry/Edit fields the owner can hide from Quotes Settings. **Quote Text and Category are
 * required and always shown** (not listed here), as are the favourite heart + action buttons.
 * Stored on `profile.quote_visible_fields` (NULL = all visible).
 */
export const QUOTE_ENTRY_FIELDS: { key: string; label: string }[] = [
  { key: 'author', label: 'Author' },
  { key: 'source_link', label: 'Source link' },
  { key: 'source_type', label: 'Source Type' },
  { key: 'title', label: 'Title' },
  { key: 'tags', label: 'Tags' },
  { key: 'language', label: 'Language' },
]

/** Whether an Entry field is visible. NULL stored prefs (or an unknown key) ⇒ visible (default-on). */
export function isFieldVisible(visibleFields: string[] | null, key: string): boolean {
  return visibleFields == null || visibleFields.includes(key)
}
