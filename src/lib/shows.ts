/**
 * Shows (TV & movies)  domain helpers — UI-framework-free so they're unit-tested and shared by Shows functions.
 * DB access lives in `src/data/show.ts`; enums + labels live in `src/constants/shows.ts`;
 * TMDB mapping lives in `src/lib/shows-tmdb-api.ts`.
 */
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'
import type { IsoDate } from './date'
import type { ShowMetadata } from './shows-tmdb-api'
import { type Dynasty, dynastySortRank } from '../constants/dynasty'
import { type LgbtqRep } from '../constants/lgbtq'
import { type ShowType, type ShowStatus } from '../constants/shows'
import { foldZh } from './zh-fold'

export type ShowRow = Tables<'show'>
export type ShowInsert = TablesInsert<'show'>
export type ShowUpdate = TablesUpdate<'show'>

/** Episodic types carry the season/episode UI + watched counts; a movie is a single title. */
export function usesEpisodes(type: string): boolean {
  return type === 'tv' || type === 'documentary'
}

// --- Poster URLs. `poster_path` holds EITHER a TMDB path OR a full pasted image URL. ---
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

/** True for a full `http(s)://` URL — a manually pasted poster, not a TMDB path. */
export function isAbsoluteUrl(path: string | null | undefined): boolean {
  return !!path && /^https?:\/\//i.test(path)
}

/**
 * Build a poster URL for a size (e.g. `w92` list, `w342` detail); null when no poster. An
 * absolute pasted URL is returned as-is (size ignored); a TMDB path gets the fixed CDN base.
 */
export function posterUrl(path: string | null | undefined, size: string): string | null {
  if (!path) return null
  return isAbsoluteUrl(path) ? path : `${TMDB_IMAGE_BASE}/${size}${path}`
}

// --- Status transitions (pure: take `today` so they're deterministic in tests) ---

/** "Start Watching": status → watching + start date → today. */
export function startWatching(today: IsoDate): Pick<ShowUpdate, 'status' | 'start_date'> {
  return { status: 'watching', start_date: today }
}

/** "Mark Watched": status → watched, finish date → today, and (episodic) watched counts → totals. */
export function markWatched(
  show: Pick<ShowRow, 'type' | 'total_seasons' | 'total_episodes'>,
  today: IsoDate,
): Pick<ShowUpdate, 'status' | 'end_date' | 'watched_seasons' | 'watched_episodes'> {
  const episodic = usesEpisodes(show.type)
  return {
    status: 'watched',
    end_date: today,
    watched_seasons: episodic ? show.total_seasons : null,
    watched_episodes: episodic ? show.total_episodes : null,
  }
}

// --- Per-show "Refresh from TMDB": re-pull metadata, never touch owner fields ---

/** The TMDB-sourced columns Refresh may update (owner fields — status/rating/dates/etc — excluded). */
const REFRESH_FIELDS = [
  'title',
  'original_title',
  'overview',
  'genres',
  'director',
  'cast',
  'total_seasons',
  'total_episodes',
  'runtime_min',
  'original_language',
] as const

const sameArray = (a: string[] | null, b: string[] | null): boolean =>
  (a ?? null) === (b ?? null) ||
  (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]))

/**
 * Build the patch for a per-show Refresh: only the TMDB-sourced fields above, plus the poster.
 * Never `year`/`imdb_id` (per spec) and never owner fields (status, rating, lgbtq_rep, dates,
 * notes, watched counts, is_favorite). A **manually pasted** poster (an absolute URL) is
 * preserved; otherwise the TMDB poster is applied. `changed` is false when nothing differs, so
 * the caller can skip the write and report "no changes" (idempotent + non-destructive).
 */
export function buildRefreshPatch(
  show: Pick<ShowRow, (typeof REFRESH_FIELDS)[number] | 'poster_path'>,
  meta: ShowMetadata,
): { patch: ShowUpdate; changed: boolean } {
  const patch: ShowUpdate = {
    title: meta.title,
    original_title: meta.original_title,
    overview: meta.overview,
    genres: meta.genres,
    director: meta.director,
    cast: meta.cast,
    total_seasons: meta.total_seasons,
    total_episodes: meta.total_episodes,
    runtime_min: meta.runtime_min,
    original_language: meta.original_language,
  }
  // Preserve a manually pasted poster; otherwise adopt the TMDB poster.
  if (!isAbsoluteUrl(show.poster_path)) patch.poster_path = meta.poster_path

  const changed =
    REFRESH_FIELDS.some((k) =>
      k === 'genres' || k === 'cast'
        ? !sameArray(show[k], patch[k] as string[] | null)
        : show[k] !== patch[k],
    ) ||
    (patch.poster_path !== undefined && patch.poster_path !== show.poster_path)
  return { patch, changed }
}

/** "S{watched_seasons} · {watched_episodes}/{total_episodes}" — the TV progress label. */
export function progressLabel(
  show: Pick<ShowRow, 'watched_seasons' | 'watched_episodes' | 'total_episodes'>,
): string {
  return `S${show.watched_seasons ?? 0} · ${show.watched_episodes ?? 0}/${show.total_episodes ?? 0}`
}

/** A runtime in minutes as "2h 10m" / "1h" / "45m" (no leading zero hour). */
export function formatRuntime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/**
 * A compact "what am I getting into" length cue for a row: `~2h 10m` for a movie (its runtime),
 * `3 seasons` (or `1 season`) / `12 eps` for episodic types. Null when there's no length data.
 */
export function lengthHint(
  show: Pick<ShowRow, 'type' | 'runtime_min' | 'total_seasons' | 'total_episodes'>,
): string | null {
  if (!usesEpisodes(show.type)) {
    return show.runtime_min ? `~${formatRuntime(show.runtime_min)}` : null
  }
  if (show.total_seasons) {
    return `${show.total_seasons} season${show.total_seasons === 1 ? '' : 's'}`
  }
  if (show.total_episodes) return `${show.total_episodes} eps`
  return null
}

/** Dashboard "Up Next": an in-progress TV show with episodes still to watch. */
export function isUpNext(
  show: Pick<ShowRow, 'status' | 'type' | 'watched_episodes' | 'total_episodes'>,
): boolean {
  return (
    show.status === 'watching' &&
    show.type === 'tv' &&
    (show.watched_episodes ?? 0) < (show.total_episodes ?? 0)
  )
}

/** Dashboard "Favourites": starred titles (incoming order preserved). */
export function favoriteShows<T extends Pick<ShowRow, 'is_favorite'>>(shows: T[]): T[] {
  return shows.filter((s) => s.is_favorite)
}

/**
 * Dashboard "Recently Watched": the most-recently-finished titles. Imported rows with no
 * `end_date` are excluded by design — they live in the Library, not the recent shelf.
 */
export function recentlyWatched<T extends Pick<ShowRow, 'status' | 'end_date'>>(
  shows: T[],
  limit: number,
): T[] {
  return shows
    .filter((s) => s.status === 'watched' && s.end_date != null)
    .sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''))
    .slice(0, limit)
}

/** Count titles finished in a given calendar year (by `end_date`). */
export function countWatchedThisYear(
  shows: Pick<ShowRow, 'status' | 'end_date'>[],
  year: number,
): number {
  const prefix = `${year}-`
  return shows.filter((s) => s.status === 'watched' && s.end_date?.startsWith(prefix))
    .length
}

// --- Library filtering + sorting (pure; the screen just holds the criteria state) ---

/** Sort/precedence order for statuses. */
const SHOW_STATUS_ORDER: Record<ShowStatus, number> = {
  want: 0,
  watching: 1,
  watched: 2,
  dropped: 3,
}

/** Sorted unique genres present across the given shows (drives the Library Genre filter). */
export function showGenres(shows: Pick<ShowRow, 'genres'>[]): string[] {
  const set = new Set<string>()
  for (const s of shows) for (const g of s.genres ?? []) set.add(g)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/**
 * Folded text the Library search matches: title + original title + director + cast.
 * Traditional⇄Simplified agnostic via {@link foldZh} (lowercases + normalizes Chinese variant).
 */
export function searchableText(
  show: Pick<ShowRow, 'title' | 'original_title' | 'director' | 'cast'>,
): string {
  return foldZh(
    [show.title, show.original_title, show.director, ...(show.cast ?? [])]
      .filter(Boolean)
      .join(' '),
  )
}

export type SortField =
  | 'title'
  | 'type'
  | 'year'
  | 'status'
  | 'rating'
  | 'genre'
  | 'dynasty'
  | 'date'
export type SortDir = 'asc' | 'desc'

export interface LibraryCriteria {
  query: string
  type: 'all' | ShowType
  genre: 'all' | string
  minRating: number // 0 = any
  lgbtq: 'all' | LgbtqRep
  dynasty: 'all' | Dynasty
  status: 'all' | ShowStatus
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
  type: 'all',
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

function matchesCriteria(show: ShowRow, c: LibraryCriteria): boolean {
  const q = foldZh(c.query.trim())
  if (q && !searchableText(show).includes(q)) return false
  if (c.type !== 'all' && show.type !== c.type) return false
  if (c.status !== 'all' && show.status !== c.status) return false
  if (c.favoritesOnly && !show.is_favorite) return false
  if (c.lgbtq !== 'all' && (show.lgbtq_rep ?? 'none') !== c.lgbtq) return false
  if (c.dynasty !== 'all' && show.dynasty !== c.dynasty) return false
  if (c.genre !== 'all' && !(show.genres ?? []).includes(c.genre)) return false
  if (c.minRating > 0 && (show.rating ?? 0) < c.minRating) return false
  if (c.startFrom && (!show.start_date || show.start_date < c.startFrom)) return false
  if (c.startTo && (!show.start_date || show.start_date > c.startTo)) return false
  if (c.endFrom && (!show.end_date || show.end_date < c.endFrom)) return false
  if (c.endTo && (!show.end_date || show.end_date > c.endTo)) return false
  return true
}

function sortKey(show: ShowRow, field: SortField): string | number | null {
  switch (field) {
    case 'title':
      return show.title.toLowerCase()
    case 'type':
      return show.type
    case 'year':
      return show.year
    case 'status':
      return SHOW_STATUS_ORDER[show.status as ShowStatus] ?? 99
    case 'rating':
      return show.rating
    case 'genre':
      return show.genres?.[0]?.toLowerCase() ?? null
    case 'dynasty':
      // Chronological oldest→newest ascending (先秦 first … 近代 … 全部 last); non-Chinese sorts last.
      return dynastySortRank(show.dynasty)
    case 'date':
      // Finish date if any, else the start/added date. (`updated_at` is import-time noise here.)
      return show.end_date ?? show.start_date
  }
}

function compareShows(a: ShowRow, b: ShowRow, field: SortField, dir: SortDir): number {
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

/** Filter then sort a Library list. Pure — does not mutate `shows`. */
export function applyLibraryView(shows: ShowRow[], c: LibraryCriteria): ShowRow[] {
  return shows
    .filter((s) => matchesCriteria(s, c))
    .sort((a, b) => compareShows(a, b, c.sortField, c.sortDir))
}

// --- Entry/Edit field visibility (Shows Settings) ---

/**
 * The Entry/Edit fields the owner can hide from Shows Settings. The core Type / Title / Status /
 * Search-TMDB controls are always shown and are not listed here. Stored on `profile.show_visible_fields`
 * (NULL = all visible); `'episodes'` covers the TV season/episode block, `'metadata'` the read-only
 * TMDB display.
 */
export const SHOW_VISIBLE_FIELDS: { key: string; label: string }[] = [
  { key: 'original_title', label: 'Original Title' },
  { key: 'year', label: 'Year' },
  { key: 'metadata', label: 'TMDB Metadata' },
  { key: 'rating', label: 'Rating' },
  { key: 'lgbtq_rep', label: 'LGBT+ Representation' },
  { key: 'dynasty', label: 'Dynasty' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'Finish / Drop Date' },
  { key: 'episodes', label: 'Season & Episode Counts' },
  { key: 'notes', label: 'Notes' },
]

/** Whether an Entry field is visible. NULL stored prefs (or an unknown key) ⇒ visible (default-on). */
export function isFieldVisible(visibleFields: string[] | null, key: string): boolean {
  return visibleFields == null || visibleFields.includes(key)
}
