/**
 * Shows (TV & movies) domain helpers — UI-framework-free so they're unit-tested and shared by Shows functions.
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

/** `season_episode_counts` round-trips through `jsonb` (typed as `Json`) but is always written as
 * `{ [seasonNumber]: episodeCount }`; this normalizes it to a plain lookup keyed by season number,
 * used by both the diffing in `buildRefreshPatch` and the summing in `totalWatchedEpisodes`. */
function seasonCounts(
  value: ShowRow['season_episode_counts'] | Record<number, number> | null,
): Record<number, number> {
  return (value as Record<number, number> | null) ?? {}
}

const sameArray = (a: string[] | null, b: string[] | null): boolean =>
  (a ?? null) === (b ?? null) ||
  (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]))

const sameSeasonCounts = (
  a: ShowRow['season_episode_counts'],
  b: Record<number, number> | null,
): boolean => {
  const av = seasonCounts(a)
  const bv = seasonCounts(b)
  const aKeys = Object.keys(av)
  const bKeys = Object.keys(bv)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((k) => av[Number(k)] === bv[Number(k)])
}

/**
 * Build the patch for a per-show Refresh: only the TMDB-sourced fields above, plus the poster.
 * Never `year`/`imdb_id` (per spec) and never owner fields (status, rating, lgbtq_rep, dates,
 * notes, watched counts, is_favorite). A **manually pasted** poster (an absolute URL) is
 * preserved; otherwise the TMDB poster is applied. `changed` is false when nothing differs, so
 * the caller can skip the write and report "no changes" (idempotent + non-destructive).
 */
export function buildRefreshPatch(
  show: Pick<
    ShowRow,
    (typeof REFRESH_FIELDS)[number] | 'poster_path' | 'season_episode_counts'
  >,
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
    season_episode_counts: meta.season_episode_counts,
  }
  // Preserve a manually pasted poster; otherwise adopt the TMDB poster.
  if (!isAbsoluteUrl(show.poster_path)) patch.poster_path = meta.poster_path

  const changed =
    REFRESH_FIELDS.some((k) =>
      k === 'genres' || k === 'cast'
        ? !sameArray(show[k], patch[k] as string[] | null)
        : show[k] !== patch[k],
    ) ||
    !sameSeasonCounts(
      show.season_episode_counts,
      patch.season_episode_counts as Record<number, number> | null,
    ) ||
    (patch.poster_path !== undefined && patch.poster_path !== show.poster_path)
  return { patch, changed }
}

/** "S{watched_seasons} · {cumulative watched}/{total_episodes}" — the TV progress label. The
 * numerator is the true series-wide total watched (see `totalWatchedEpisodes`), not just the
 * in-season count, so a show mid-way through season 2 reads e.g. "S2 · 17/18" rather than "S2 · 7/18". */
export function progressLabel(
  show: Pick<
    ShowRow,
    'watched_seasons' | 'watched_episodes' | 'total_episodes' | 'season_episode_counts'
  >,
): string {
  return `S${show.watched_seasons ?? 0} · ${totalWatchedEpisodes(show)}/${show.total_episodes ?? 0}`
}

/**
 * Cumulative episodes watched across the whole series. `watched_episodes` is entered as the count
 * WITHIN `watched_seasons` (the owner's convention — e.g. season 2, 7 eps means "all of season 1
 * plus 7 of season 2"), so this sums the full episode counts of every prior season from
 * `season_episode_counts` and adds the in-season count. Falls back to the raw `watched_episodes`
 * value (old per-season-only behaviour) when `season_episode_counts` isn't available — e.g. a
 * manually-entered title with no TMDB match, or a row saved before this field existed.
 */
export function totalWatchedEpisodes(
  show: Pick<ShowRow, 'watched_seasons' | 'watched_episodes' | 'season_episode_counts'>,
): number {
  const inSeason = show.watched_episodes ?? 0
  const watchedSeason = show.watched_seasons ?? 0
  if (!show.season_episode_counts || watchedSeason <= 0) return inSeason
  const counts = seasonCounts(show.season_episode_counts)
  let priorSeasons = 0
  for (let s = 1; s < watchedSeason; s++) priorSeasons += counts[s] ?? 0
  return priorSeasons + inSeason
}

/**
 * True when the owner has watched everything TMDB currently lists as available for an episodic
 * title that's still marked "Watching" (as opposed to "Watched" — the owner is deliberately
 * waiting on a next season/episode, not done with the show). Used to surface the dashboard's
 * "Caught Up" shelf/chip. Always false when there's no known total (can't tell).
 */
export function isCaughtUp(
  show: Pick<
    ShowRow,
    | 'status'
    | 'type'
    | 'watched_seasons'
    | 'watched_episodes'
    | 'total_episodes'
    | 'season_episode_counts'
  >,
): boolean {
  if (show.status !== 'watching' || !usesEpisodes(show.type)) return false
  if (!show.total_episodes) return false
  return totalWatchedEpisodes(show) >= show.total_episodes
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

/**
 * Shared "date" ordering key: finish date if known, else last-updated timestamp.
 * Used by both the Library's `date` sort and the Dashboard shelves below.
 */
function dashboardDateKey(show: Pick<ShowRow, 'end_date' | 'updated_at'>): string {
  return show.end_date ?? show.updated_at
}

/** Sorts most-recent-first by `dashboardDateKey`, breaking ties by `start_date` then title. */
export function sortByRecency<
  T extends Pick<ShowRow, 'title' | 'start_date' | 'end_date' | 'updated_at'>,
>(shows: T[]): T[] {
  return [...shows].sort((a, b) => {
    const primary = dashboardDateKey(b).localeCompare(dashboardDateKey(a))
    if (primary !== 0) return primary
    if (a.start_date !== b.start_date) {
      if (a.start_date == null) return 1
      if (b.start_date == null) return -1
      return b.start_date.localeCompare(a.start_date)
    }
    return a.title.localeCompare(b.title)
  })
}

/**
 * Dashboard "Recently Watched": the most-recently-finished titles. Imported rows with no
 * `end_date` are excluded by design — they live in the Library, not the recent shelf.
 */
export function recentlyWatched<
  T extends Pick<ShowRow, 'title' | 'status' | 'start_date' | 'end_date' | 'updated_at'>,
>(shows: T[], limit: number): T[] {
  return sortByRecency(
    shows.filter((s) => s.status === 'watched' && s.end_date != null),
  ).slice(0, limit)
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
  notesOnly: boolean
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
  notesOnly: false,
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
  if (c.notesOnly && !show.notes?.trim()) return false
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
      // Finish date if any, else last-updated timestamp; start_date only breaks ties (see compareShows).
      return show.end_date ?? show.updated_at
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
  // On a `date` tie, break by start_date before falling back to title.
  if (field === 'date' && a.start_date !== b.start_date) {
    if (a.start_date == null) return 1
    if (b.start_date == null) return -1
    const startCmp = a.start_date.localeCompare(b.start_date)
    return dir === 'asc' ? startCmp : -startCmp
  }
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
