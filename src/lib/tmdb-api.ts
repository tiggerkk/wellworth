import type { ShowType } from './shows'

/**
 * TMDB (The Movie Database) client + pure field mapping. Called directly from the browser with
 * VITE_TMDB_API_KEY (a v3 api_key query param — same browser-var pattern as USDA). Two-step,
 * on-demand only: search → details on select. Only the pure mappers below are unit-tested
 * (matching food-api / off-api / fx); the network calls are not. Nothing is persisted here —
 * the Entry form writes mapped fields into a `show` row only on CREATE/SAVE.
 */

const TMDB_BASE = 'https://api.themoviedb.org/3'

/** A lightweight search hit, scoped to the searched Type. */
export interface TmdbSearchResult {
  tmdbId: number
  type: ShowType
  title: string
  year: number | null
  posterPath: string | null
}

/** The subset of `show` columns TMDB populates (merged into the draft on select). */
export interface ShowMetadata {
  title: string
  original_title: string | null
  year: number | null
  poster_path: string | null
  overview: string | null
  genres: string[] | null
  director: string | null
  cast: string[] | null
  runtime_min: number | null
  original_language: string | null
  total_seasons: number | null
  total_episodes: number | null
  tmdb_id: number
  imdb_id: string | null
}

// --- Loose shapes for the TMDB JSON (only the fields we read) ---
interface TmdbGenre {
  name?: string
}
interface TmdbCastMember {
  name?: string
}
interface TmdbCrewMember {
  job?: string
  name?: string
}
interface TmdbCredits {
  cast?: TmdbCastMember[]
  crew?: TmdbCrewMember[]
}
interface TmdbExternalIds {
  imdb_id?: string | null
}
interface TmdbCreatedBy {
  name?: string
}
interface TmdbMovieSearchItem {
  id: number
  title?: string
  release_date?: string
  poster_path?: string | null
}
interface TmdbTvSearchItem {
  id: number
  name?: string
  first_air_date?: string
  poster_path?: string | null
}
export interface TmdbMovieDetails {
  id: number
  title?: string
  original_title?: string
  release_date?: string
  poster_path?: string | null
  overview?: string
  genres?: TmdbGenre[]
  runtime?: number | null
  original_language?: string
  imdb_id?: string | null
  credits?: TmdbCredits
  external_ids?: TmdbExternalIds
}
export interface TmdbTvDetails {
  id: number
  name?: string
  original_name?: string
  first_air_date?: string
  poster_path?: string | null
  overview?: string
  genres?: TmdbGenre[]
  episode_run_time?: number[]
  number_of_seasons?: number | null
  number_of_episodes?: number | null
  original_language?: string
  created_by?: TmdbCreatedBy[]
  credits?: TmdbCredits
  external_ids?: TmdbExternalIds
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const nonEmpty = (arr: string[] | undefined): string[] | null =>
  arr && arr.length ? arr : null

/** Parse a TMDB date ('YYYY-MM-DD') to a release/air year, or null. */
export function pickYear(date: string | null | undefined): number | null {
  if (!date) return null
  const y = Number(date.slice(0, 4))
  return Number.isFinite(y) && y > 0 ? y : null
}

/** Movie director(s) — crew members whose job is "Director", names joined. */
export function pickDirectorFromCrew(crew: TmdbCrewMember[] | undefined): string | null {
  const names = (crew ?? [])
    .filter((c) => c.job === 'Director')
    .map((c) => c.name)
    .filter(isStr)
  return names.length ? names.join(', ') : null
}

function pickCreators(created: TmdbCreatedBy[] | undefined): string | null {
  const names = (created ?? []).map((c) => c.name).filter(isStr)
  return names.length ? names.join(', ') : null
}

/** Top ~10 cast names. */
export function pickCast(cast: TmdbCastMember[] | undefined): string[] | null {
  return nonEmpty(
    (cast ?? [])
      .slice(0, 10)
      .map((c) => c.name)
      .filter(isStr),
  )
}

export function mapSearchResults(
  type: ShowType,
  json: { results?: unknown[] },
): TmdbSearchResult[] {
  const results = json.results ?? []
  if (type === 'movie') {
    return (results as TmdbMovieSearchItem[]).map((r) => ({
      tmdbId: r.id,
      type,
      title: r.title ?? '',
      year: pickYear(r.release_date),
      posterPath: r.poster_path ?? null,
    }))
  }
  return (results as TmdbTvSearchItem[]).map((r) => ({
    tmdbId: r.id,
    type,
    title: r.name ?? '',
    year: pickYear(r.first_air_date),
    posterPath: r.poster_path ?? null,
  }))
}

export function mapMovieDetails(d: TmdbMovieDetails): ShowMetadata {
  return {
    title: d.title ?? '',
    original_title: d.original_title || null,
    year: pickYear(d.release_date),
    poster_path: d.poster_path ?? null,
    overview: d.overview || null,
    genres: nonEmpty(d.genres?.map((g) => g.name).filter(isStr)),
    director: pickDirectorFromCrew(d.credits?.crew),
    cast: pickCast(d.credits?.cast),
    runtime_min: d.runtime ?? null,
    original_language: d.original_language || null,
    total_seasons: null,
    total_episodes: null,
    tmdb_id: d.id,
    imdb_id: d.imdb_id ?? d.external_ids?.imdb_id ?? null,
  }
}

export function mapTvDetails(d: TmdbTvDetails): ShowMetadata {
  return {
    title: d.name ?? '',
    original_title: d.original_name || null,
    year: pickYear(d.first_air_date),
    poster_path: d.poster_path ?? null,
    overview: d.overview || null,
    genres: nonEmpty(d.genres?.map((g) => g.name).filter(isStr)),
    director: pickCreators(d.created_by),
    cast: pickCast(d.credits?.cast),
    runtime_min: d.episode_run_time?.[0] ?? null,
    original_language: d.original_language || null,
    total_seasons: d.number_of_seasons ?? null,
    total_episodes: d.number_of_episodes ?? null,
    tmdb_id: d.id,
    imdb_id: d.external_ids?.imdb_id ?? null,
  }
}

function apiKey(): string {
  const key = import.meta.env.VITE_TMDB_API_KEY
  if (!key) {
    throw new Error('TMDB is not configured — add VITE_TMDB_API_KEY to .env.')
  }
  return key
}

/** Search TMDB for the given Type → lightweight results (title, year, poster). */
export async function searchTitles(
  type: ShowType,
  query: string,
): Promise<TmdbSearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const endpoint = type === 'movie' ? 'movie' : 'tv'
  const params = new URLSearchParams({
    api_key: apiKey(),
    query: q,
    include_adult: 'false',
  })
  const res = await fetch(`${TMDB_BASE}/search/${endpoint}?${params.toString()}`)
  if (!res.ok) throw new Error(`TMDB search failed (${res.status})`)
  const json = (await res.json()) as { results?: unknown[] }
  return mapSearchResults(type, json)
}

/** Fetch full details for a selected title and map them into our `show` columns. */
export async function getTitleDetails(
  type: ShowType,
  tmdbId: number,
): Promise<ShowMetadata> {
  const endpoint = type === 'movie' ? 'movie' : 'tv'
  const params = new URLSearchParams({
    api_key: apiKey(),
    append_to_response: 'credits,external_ids',
  })
  const res = await fetch(`${TMDB_BASE}/${endpoint}/${tmdbId}?${params.toString()}`)
  if (!res.ok) throw new Error(`TMDB details failed (${res.status})`)
  const json = await res.json()
  return type === 'movie'
    ? mapMovieDetails(json as TmdbMovieDetails)
    : mapTvDetails(json as TmdbTvDetails)
}
