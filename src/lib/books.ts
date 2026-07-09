/**
 * Books (read / to read) domain constants + pure helpers. UI-framework-free so it's unit-tested
 * and shared by the Entry form, the Library, and the (M4) Dashboard. DB access lives in
 * `src/data/book.ts`; Google Books / Open Library mapping will live in `src/lib/books-api.ts` (M3).
 */
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'
import type { IsoDate } from './date'
import { type Dynasty, dynastySortRank } from '../constants/dynasty'
import { foldZh } from './zh-fold'
import { BOOK_STATUSES, LGBTQ_REPS } from '../constants/books'

export type BookRow = Tables<'book'>
export type BookInsert = TablesInsert<'book'>
export type BookUpdate = TablesUpdate<'book'>

export type BookStatus = (typeof BOOK_STATUSES)[number]

export type LgbtqRep = (typeof LGBTQ_REPS)[number]

// --- Status transitions (pure: take `today` so they're deterministic in tests) ---

/** "Start Reading": status → reading + start date → today. */
export function startReading(today: IsoDate): Pick<BookUpdate, 'status' | 'start_date'> {
  return { status: 'reading', start_date: today }
}

/** "Mark Read": status → read + finish date → today. */
export function markRead(today: IsoDate): Pick<BookUpdate, 'status' | 'end_date'> {
  return { status: 'read', end_date: today }
}

/** Folded text the Library search matches: title + author(s) (Traditional⇄Simplified agnostic). */
export function bookSearchText(book: Pick<BookRow, 'title' | 'authors'>): string {
  return foldZh([book.title, ...(book.authors ?? [])].filter(Boolean).join(' '))
}

// --- Dashboard selectors (pure; the screen just renders the shelves) ---

/** Dashboard "Currently Reading": all in-progress books (incoming order preserved). */
export function currentlyReading<T extends Pick<BookRow, 'status'>>(books: T[]): T[] {
  return books.filter((b) => b.status === 'reading')
}

/** Dashboard "Favourites": starred books (incoming order preserved). */
export function favoriteBooks<T extends Pick<BookRow, 'is_favorite'>>(books: T[]): T[] {
  return books.filter((b) => b.is_favorite)
}

/** Dashboard "Want to Read": the to-read shelf, capped to `limit`. */
export function wantToRead<T extends Pick<BookRow, 'status'>>(
  books: T[],
  limit: number,
): T[] {
  return books.filter((b) => b.status === 'want').slice(0, limit)
}

/**
 * Dashboard "Recently Read": the most-recently-finished books. Imported rows with no `end_date`
 * are excluded by design — they live in the Library, not the recent shelf (same rule as Shows).
 */
export function recentlyRead<T extends Pick<BookRow, 'status' | 'end_date'>>(
  books: T[],
  limit: number,
): T[] {
  return books
    .filter((b) => b.status === 'read' && b.end_date != null)
    .sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))
    .slice(0, limit)
}

/** Count books finished in a given calendar year (by `end_date`). */
export function countReadThisYear(
  books: Pick<BookRow, 'status' | 'end_date'>[],
  year: number,
): number {
  const prefix = `${year}-`
  return books.filter((b) => b.status === 'read' && b.end_date?.startsWith(prefix)).length
}

// --- Library filtering + sorting (pure; the screen just holds the criteria state) ---

/** Sort/precedence order for statuses (used by Library sort). */
const BOOK_STATUS_ORDER: Record<BookStatus, number> = {
  want: 0,
  reading: 1,
  read: 2,
  dropped: 3,
} as const

/** Sorted unique genres present across the given books (drives the Library Genre filter). */
export function bookGenres(books: Pick<BookRow, 'genres'>[]): string[] {
  const set = new Set<string>()
  for (const b of books) for (const g of b.genres ?? []) set.add(g)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Sorted unique authors present across the given books (drives the Library Author filter). */
export function bookAuthors(books: Pick<BookRow, 'authors'>[]): string[] {
  const set = new Set<string>()
  for (const b of books) for (const a of b.authors ?? []) set.add(a)
  return [...set].sort((a, b) => a.localeCompare(b))
}

export type SortField =
  | 'title'
  | 'author'
  | 'year'
  | 'status'
  | 'rating'
  | 'genre'
  | 'dynasty'
  | 'date'
export type SortDir = 'asc' | 'desc'

export interface LibraryCriteria {
  query: string
  genre: 'all' | string
  minRating: number // 0 = any
  lgbtq: 'all' | LgbtqRep
  dynasty: 'all' | Dynasty
  status: 'all' | BookStatus
  favoritesOnly: boolean
  startFrom: IsoDate | null
  startTo: IsoDate | null
  endFrom: IsoDate | null
  endTo: IsoDate | null
  sortField: SortField
  sortDir: SortDir
}

export const DEFAULT_LIBRARY_CRITERIA: LibraryCriteria = {
  query: '',
  genre: 'all',
  minRating: 0,
  lgbtq: 'all',
  dynasty: 'all',
  status: 'all',
  favoritesOnly: false,
  startFrom: null,
  startTo: null,
  endFrom: null,
  endTo: null,
  sortField: 'date',
  sortDir: 'desc',
}

function matchesCriteria(book: BookRow, c: LibraryCriteria): boolean {
  const q = foldZh(c.query.trim())
  if (q && !bookSearchText(book).includes(q)) return false
  if (c.status !== 'all' && book.status !== c.status) return false
  if (c.lgbtq !== 'all' && (book.lgbtq_rep ?? 'none') !== c.lgbtq) return false
  if (c.dynasty !== 'all' && book.dynasty !== c.dynasty) return false
  if (c.genre !== 'all' && !(book.genres ?? []).includes(c.genre)) return false
  if (c.favoritesOnly && !book.is_favorite) return false
  if (c.minRating > 0 && (book.rating ?? 0) < c.minRating) return false
  if (c.startFrom && (!book.start_date || book.start_date < c.startFrom)) return false
  if (c.startTo && (!book.start_date || book.start_date > c.startTo)) return false
  if (c.endFrom && (!book.end_date || book.end_date < c.endFrom)) return false
  if (c.endTo && (!book.end_date || book.end_date > c.endTo)) return false
  return true
}

function sortKey(book: BookRow, field: SortField): string | number | null {
  switch (field) {
    case 'title':
      return book.title.toLowerCase()
    case 'author':
      return book.authors?.[0]?.toLowerCase() ?? null
    case 'year':
      return book.year
    case 'status':
      return BOOK_STATUS_ORDER[book.status as BookStatus] ?? 99
    case 'rating':
      return book.rating
    case 'genre':
      return book.genres?.[0]?.toLowerCase() ?? null
    case 'dynasty':
      // Chronological oldest→newest ascending (先秦 first … 近代 … 全部 last); non-Chinese sorts last.
      return dynastySortRank(book.dynasty)
    case 'date':
      // Finish date if any, else the start/added date. (`updated_at` is import-time noise here.)
      return book.end_date ?? book.start_date
  }
}

function compareBooks(a: BookRow, b: BookRow, field: SortField, dir: SortDir): number {
  const ka = sortKey(a, field)
  const kb = sortKey(b, field)
  // Missing values always sort last, regardless of direction.
  if (ka == null && kb == null) return a.title.localeCompare(b.title)
  if (ka == null) return 1
  if (kb == null) return -1
  const primary =
    typeof ka === 'number' && typeof kb === 'number'
      ? ka - kb
      : String(ka).localeCompare(String(kb))
  if (primary !== 0) return dir === 'asc' ? primary : -primary
  return a.title.localeCompare(b.title) // stable tiebreak
}

/** Filter then sort a Library list. Pure — does not mutate `books`. */
export function applyLibraryView(books: BookRow[], c: LibraryCriteria): BookRow[] {
  return books
    .filter((b) => matchesCriteria(b, c))
    .sort((a, b) => compareBooks(a, b, c.sortField, c.sortDir))
}

/** Whether an Entry field is visible. NULL stored prefs (or an unknown key) ⇒ visible (default-on). */
export function isFieldVisible(visibleFields: string[] | null, key: string): boolean {
  return visibleFields == null || visibleFields.includes(key)
}
