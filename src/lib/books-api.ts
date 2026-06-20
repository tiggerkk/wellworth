/**
 * Google Books (primary) + Open Library (fallback) client + pure field mapping. Called directly
 * from the browser — both APIs are CORS-enabled. Two-step, on-demand only: search → details on
 * select. Only the pure mappers below are unit-tested (matching tmdb-api / food-api / off-api / fx);
 * the network calls are not. Nothing is persisted here — the Entry form writes mapped fields into a
 * `book` row only on CREATE/SAVE.
 *
 * Unlike `tmdb-api.ts`, the Google Books API key is **optional** — the API works keyless (at a lower
 * quota), so `googleKeyParam()` never throws; it just appends `&key=…` when one is configured.
 */

const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1'
const OPEN_LIBRARY_BASE = 'https://openlibrary.org'
const OL_COVERS_BASE = 'https://covers.openlibrary.org/b/id'

/** A lightweight search hit (covers the Title Search rows + carries enough to fetch details). */
export interface BookSearchResult {
  source: 'google' | 'openlibrary'
  /** Google volume id, or Open Library work key (e.g. `OL45804W`). */
  sourceId: string
  title: string
  authors: string[] | null
  year: number | null
  coverUrl: string | null
}

/** The subset of `book` columns metadata populates (merged into the draft on select). */
export interface BookMetadata {
  title: string
  authors: string[] | null
  year: number | null
  cover_url: string | null
  description: string | null
  genres: string[] | null
  page_count: number | null
  language: string | null
  isbn: string | null
  google_books_id: string | null
  open_library_id: string | null
}

// --- Loose shapes for the JSON (only the fields we read) ---
interface GoogleIndustryId {
  type?: string
  identifier?: string
}
interface GoogleImageLinks {
  thumbnail?: string
  smallThumbnail?: string
}
interface GoogleVolumeInfo {
  title?: string
  subtitle?: string
  authors?: string[]
  publishedDate?: string
  description?: string
  pageCount?: number
  categories?: string[]
  imageLinks?: GoogleImageLinks
  language?: string
  industryIdentifiers?: GoogleIndustryId[]
}
interface GoogleVolume {
  id?: string
  volumeInfo?: GoogleVolumeInfo
}
interface OpenLibraryDoc {
  key?: string // '/works/OL45804W'
  title?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  isbn?: string[]
  language?: string[]
}
type OpenLibraryDescription = string | { value?: string } | undefined
interface OpenLibraryWork {
  description?: OpenLibraryDescription
  subjects?: string[]
  covers?: number[]
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const nonEmpty = (arr: string[] | undefined | null): string[] | null =>
  arr && arr.length ? arr : null

const MAX_GENRES = 8

/** Parse a publish year from Google's `publishedDate` ('YYYY' | 'YYYY-MM' | 'YYYY-MM-DD') or a
 * numeric year (Open Library's `first_publish_year`). */
export function pickPublishYear(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === '') return null
  const y = typeof value === 'number' ? value : Number(String(value).slice(0, 4))
  return Number.isFinite(y) && y > 0 ? Math.trunc(y) : null
}

/** Force https on a cover URL (Google thumbnails come back as http). */
export function httpsCover(url: string | null | undefined): string | null {
  if (!isStr(url)) return null
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}

/** Pick the best ISBN from Google's industryIdentifiers — prefer ISBN_13, else ISBN_10. */
export function pickIsbn(ids: GoogleIndustryId[] | undefined): string | null {
  const find = (type: string) => ids?.find((i) => i.type === type)?.identifier
  return find('ISBN_13') || find('ISBN_10') || null
}

/** Trim a (possibly huge, e.g. Open Library) subject/category list to a sane cap. */
export function capGenres(list: string[] | undefined, n = MAX_GENRES): string[] | null {
  return nonEmpty(
    list
      ?.map((s) => s.trim())
      .filter(isStr)
      .slice(0, n),
  )
}

/** Build an Open Library cover URL for a numeric cover id (`S` | `M` | `L`). */
export function olCoverUrl(
  coverId: number | null | undefined,
  size: 'S' | 'M' | 'L',
): string | null {
  return coverId != null ? `${OL_COVERS_BASE}/${coverId}-${size}.jpg` : null
}

export function mapGoogleSearchItems(json: {
  items?: GoogleVolume[]
}): BookSearchResult[] {
  return (json.items ?? []).map((v) => {
    const info = v.volumeInfo ?? {}
    return {
      source: 'google' as const,
      sourceId: v.id ?? '',
      title: info.title ?? '',
      authors: nonEmpty(info.authors),
      year: pickPublishYear(info.publishedDate),
      coverUrl: httpsCover(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
    }
  })
}

export function mapGoogleVolume(v: GoogleVolume): BookMetadata {
  const info = v.volumeInfo ?? {}
  return {
    title: info.title ?? '',
    authors: nonEmpty(info.authors),
    year: pickPublishYear(info.publishedDate),
    cover_url: httpsCover(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
    description: info.description || null,
    genres: capGenres(info.categories),
    page_count: info.pageCount ?? null,
    language: info.language || null,
    isbn: pickIsbn(info.industryIdentifiers),
    google_books_id: v.id ?? null,
    open_library_id: null,
  }
}

export function mapOpenLibrarySearchDocs(json: {
  docs?: OpenLibraryDoc[]
}): BookSearchResult[] {
  return (json.docs ?? []).map((d) => ({
    source: 'openlibrary' as const,
    sourceId: (d.key ?? '').replace('/works/', ''),
    title: d.title ?? '',
    authors: nonEmpty(d.author_name),
    year: pickPublishYear(d.first_publish_year),
    coverUrl: olCoverUrl(d.cover_i, 'M'),
  }))
}

/** Map an Open Library work (description + subjects) merged with the carried search result
 * (authors / year / cover / isbn aren't on the work JSON, so they come from the search hit). */
export function mapOpenLibraryWork(
  work: OpenLibraryWork,
  carried: Pick<
    BookSearchResult,
    'sourceId' | 'title' | 'authors' | 'year' | 'coverUrl'
  > & {
    isbn?: string | null
  },
): BookMetadata {
  const description =
    typeof work.description === 'string'
      ? work.description
      : (work.description?.value ?? null)
  return {
    title: carried.title,
    authors: carried.authors ?? null,
    year: carried.year,
    cover_url: carried.coverUrl ?? olCoverUrl(work.covers?.[0], 'M'),
    description: description || null,
    genres: capGenres(work.subjects),
    page_count: null,
    language: null,
    isbn: carried.isbn ?? null,
    google_books_id: null,
    open_library_id: carried.sourceId || null,
  }
}

// --- Search-result ranking (pure) ---

const normTitle = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Re-rank interactive search results for the typed `query`: titles that **start with** the query
 * first, then titles that merely **contain** it, then the rest; within each tier, **year descending**
 * (undated last). A stable tiebreak preserves the upstream (Google relevance) order. Pure — the
 * importer keeps the raw top hit (its query is `"title author"`, where prefix ranking doesn't apply).
 */
export function rankSearchResults(
  results: BookSearchResult[],
  query: string,
): BookSearchResult[] {
  const q = normTitle(query)
  if (!q) return results
  const tier = (r: BookSearchResult): number => {
    const t = normTitle(r.title)
    if (t.startsWith(q)) return 2
    if (t.includes(q)) return 1
    return 0
  }
  return results
    .map((r, i) => ({ r, i, t: tier(r) }))
    .sort((a, b) => {
      if (a.t !== b.t) return b.t - a.t
      const ay = a.r.year
      const by = b.r.year
      if (ay == null && by == null) return a.i - b.i
      if (ay == null) return 1 // undated sorts last
      if (by == null) return -1
      if (ay !== by) return by - ay // year descending
      return a.i - b.i // stable
    })
    .map((x) => x.r)
}

/**
 * Thrown when Google Books returns **429** (rate limit). The keyless quota is low; the fix is to set
 * `VITE_GOOGLE_BOOKS_API_KEY` (or search less aggressively). We surface this distinctly rather than
 * falling back to Open Library, because a 429 means "too many requests" — piling on another request
 * (especially to a possibly-unreachable host) makes it worse.
 */
export class BookSearchRateLimitError extends Error {
  constructor() {
    super('Google Books rate limit — add VITE_GOOGLE_BOOKS_API_KEY or slow down.')
    this.name = 'BookSearchRateLimitError'
  }
}

function googleKeyParam(): string {
  const key = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
  return key ? `&key=${encodeURIComponent(key)}` : ''
}

async function searchGoogle(
  query: string,
  signal?: AbortSignal,
): Promise<BookSearchResult[]> {
  const url = `${GOOGLE_BOOKS_BASE}/volumes?q=${encodeURIComponent(query)}&maxResults=20${googleKeyParam()}`
  const res = await fetch(url, { signal })
  if (res.status === 429) throw new BookSearchRateLimitError()
  if (!res.ok) throw new Error(`Google Books search failed (${res.status})`)
  const json = (await res.json()) as { items?: GoogleVolume[] }
  return mapGoogleSearchItems(json)
}

async function searchOpenLibrary(
  query: string,
  signal?: AbortSignal,
): Promise<BookSearchResult[]> {
  const fields = 'key,title,author_name,first_publish_year,cover_i,isbn,language'
  const url = `${OPEN_LIBRARY_BASE}/search.json?q=${encodeURIComponent(query)}&fields=${fields}&limit=20`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Open Library search failed (${res.status})`)
  const json = (await res.json()) as { docs?: OpenLibraryDoc[] }
  return mapOpenLibrarySearchDocs(json)
}

/**
 * Search Google Books; on an empty result set or a **non-rate-limit** error, fall back to Open
 * Library. A 429 (or an aborted request) rethrows instead — we don't pile more requests onto a
 * throttled/cancelled state.
 */
export async function searchBooks(
  query: string,
  opts?: { signal?: AbortSignal },
): Promise<BookSearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const signal = opts?.signal
  try {
    const google = await searchGoogle(q, signal)
    if (google.length) return google
  } catch (e) {
    if (e instanceof BookSearchRateLimitError) throw e
    if (signal?.aborted) throw e
    // other Google error → try Open Library
  }
  return searchOpenLibrary(q, signal)
}

/** Fetch full details for a selected result and map them into our `book` columns. */
export async function getBookDetails(
  result: BookSearchResult,
  opts?: { signal?: AbortSignal },
): Promise<BookMetadata> {
  const signal = opts?.signal
  if (result.source === 'google') {
    const url = `${GOOGLE_BOOKS_BASE}/volumes/${encodeURIComponent(result.sourceId)}?${googleKeyParam().slice(1)}`
    const res = await fetch(url, { signal })
    if (res.status === 429) throw new BookSearchRateLimitError()
    if (!res.ok) throw new Error(`Google Books details failed (${res.status})`)
    const json = (await res.json()) as GoogleVolume
    return mapGoogleVolume(json)
  }
  const url = `${OPEN_LIBRARY_BASE}/works/${encodeURIComponent(result.sourceId)}.json`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Open Library details failed (${res.status})`)
  const work = (await res.json()) as OpenLibraryWork
  return mapOpenLibraryWork(work, result)
}
