/**
 * Pure parsing + validation + row-building for the one-off Shows CSV import (see
 * `templates/shows-import-guide.md`). No I/O and no TMDB calls — the import screen reads the file,
 * resolves each row against TMDB, and writes via `saveImportedShows`.
 *
 * Column spec: `title,type,status,rating,lgbtq_rep,watched_seasons,watched_episodes`.
 */
import {
  LGBTQ_REPS,
  SHOW_STATUSES,
  SHOW_TYPES,
  type LgbtqRep,
  type ShowInsert,
  type ShowStatus,
  type ShowType,
} from './shows'
import type { ShowMetadata } from './tmdb-api'

const REQUIRED_COLUMNS = ['title', 'type', 'status']

export interface ParsedShowRow {
  title: string
  type: ShowType
  status: ShowStatus
  rating: number | null
  lgbtq_rep: LgbtqRep
  watched_seasons: number | null
  watched_episodes: number | null
}

export interface ShowsImportResult {
  rows: ParsedShowRow[]
  errors: string[]
}

/** The `show` insert fields produced from a CSV row + its TMDB match (user_id added by the data layer). */
export type ImportShowRow = Omit<ShowInsert, 'user_id'>

const typeSet = new Set<string>(SHOW_TYPES)
const statusSet = new Set<string>(SHOW_STATUSES)
const lgbtqSet = new Set<string>(LGBTQ_REPS)

function intOrNull(raw: string): number | null {
  const s = raw.trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export function parseShowsCsv(rows: string[][]): ShowsImportResult {
  const errors: string[] = []
  const out: ParsedShowRow[] = []

  if (rows.length === 0) return { rows: out, errors: ['The file is empty.'] }

  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) {
    return { rows: out, errors: [`Missing required column(s): ${missing.join(', ')}.`] }
  }

  const col = (cells: string[], name: string): string => {
    const idx = header.indexOf(name)
    return idx === -1 ? '' : (cells[idx] ?? '').trim()
  }

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!
    if (cells.every((c) => c.trim() === '')) continue // skip blank lines
    const line = r + 1 // 1-based spreadsheet row (header is line 1)

    const title = col(cells, 'title')
    if (title === '') {
      errors.push(`Row ${line}: missing title — skipped.`)
      continue
    }

    const typeRaw = col(cells, 'type')
    const type = typeRaw.toLowerCase()
    if (!typeSet.has(type)) {
      errors.push(
        `Row ${line} ("${title}"): type "${typeRaw}" must be tv or movie — skipped.`,
      )
      continue
    }

    const statusRaw = col(cells, 'status')
    const status = statusRaw.toLowerCase()
    if (!statusSet.has(status)) {
      errors.push(
        `Row ${line} ("${title}"): status "${statusRaw}" must be want/watching/watched/dropped — skipped.`,
      )
      continue
    }

    const lgbtqRaw = col(cells, 'lgbtq_rep').toLowerCase()
    const lgbtq_rep = lgbtqRaw === '' ? 'none' : lgbtqRaw
    if (!lgbtqSet.has(lgbtq_rep)) {
      errors.push(
        `Row ${line} ("${title}"): lgbtq_rep "${lgbtqRaw}" must be none/some/significant — skipped.`,
      )
      continue
    }

    const ratingRaw = col(cells, 'rating')
    let rating: number | null = null
    if (ratingRaw !== '') {
      const n = Number(ratingRaw)
      if (!Number.isFinite(n) || n < 0 || n > 5 || n * 2 !== Math.floor(n * 2)) {
        errors.push(
          `Row ${line} ("${title}"): rating "${ratingRaw}" must be 0–5 in 0.5 steps — skipped.`,
        )
        continue
      }
      rating = n
    }

    out.push({
      title,
      type: type as ShowType,
      status: status as ShowStatus,
      rating,
      lgbtq_rep: lgbtq_rep as LgbtqRep,
      watched_seasons: intOrNull(col(cells, 'watched_seasons')),
      watched_episodes: intOrNull(col(cells, 'watched_episodes')),
    })
  }

  return { rows: out, errors }
}

/** Idempotency key — a row updates an existing show with the same `type` + case-insensitive title. */
export function dedupKey(title: string, type: string): string {
  return `${type}|${title.trim().toLowerCase()}`
}

/**
 * Combine a parsed CSV row with its TMDB match (or null) into a `show` insert. Dates are left NULL
 * (imported history is genuinely undated). Watched counts: `watched` ⇒ the TMDB totals;
 * `watching`/`dropped` (TV) ⇒ the CSV values; `want` / movies ⇒ null.
 */
export function buildImportRow(
  input: ParsedShowRow,
  match: ShowMetadata | null,
): ImportShowRow {
  const tv = input.type === 'tv'
  let watched_seasons: number | null = null
  let watched_episodes: number | null = null
  if (tv) {
    if (input.status === 'watched') {
      watched_seasons = match?.total_seasons ?? null
      watched_episodes = match?.total_episodes ?? null
    } else if (input.status === 'watching' || input.status === 'dropped') {
      watched_seasons = input.watched_seasons
      watched_episodes = input.watched_episodes
    }
  }

  return {
    type: input.type,
    status: input.status,
    title: match?.title ?? input.title,
    rating: input.rating,
    lgbtq_rep: input.lgbtq_rep,
    original_title: match?.original_title ?? null,
    year: match?.year ?? null,
    poster_path: match?.poster_path ?? null,
    overview: match?.overview ?? null,
    genres: match?.genres ?? null,
    director: match?.director ?? null,
    cast: match?.cast ?? null,
    runtime_min: match?.runtime_min ?? null,
    original_language: match?.original_language ?? null,
    total_seasons: tv ? (match?.total_seasons ?? null) : null,
    total_episodes: tv ? (match?.total_episodes ?? null) : null,
    watched_seasons,
    watched_episodes,
    tmdb_id: match?.tmdb_id ?? null,
    imdb_id: match?.imdb_id ?? null,
    start_date: null,
    end_date: null,
    last_update_date: null,
    comments: null,
  }
}
