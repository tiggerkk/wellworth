/**
 * Pure parsing + validation + row-building for the Shows CSV import (see
 * `templates/shows-import-guide.md`). No I/O and no TMDB calls — the import screen reads the file,
 * resolves each row against TMDB, and writes via `saveImportedShows`.
 *
 * Column spec:
 * `title,type,status,rating,lgbtq_rep,dynasty,watched_seasons,watched_episodes,is_favorite,start_date,end_date,notes`.
 * `start_date` is required on every row; `end_date` is required for finished rows (watched/dropped)
 * and ignored otherwise; `notes` is the optional, nullable right-most column (free text; wrap
 * multi-line values in quotes). `created_at` is frozen to `start_date`; `updated_at` is left to the DB.
 */
import {
  LGBTQ_REPS,
  SHOW_STATUSES,
  SHOW_TYPES,
  usesEpisodes,
  type LgbtqRep,
  type ShowInsert,
  type ShowStatus,
  type ShowType,
} from './shows'
import type { ShowMetadata } from './tmdb-api'
import type { IsoDate } from './date'
import { containsCjk } from './cjk'
import { DYNASTIES, type Dynasty } from '../constants/dynasty'

const REQUIRED_COLUMNS = ['title', 'type', 'status']

export interface ParsedShowRow {
  title: string
  type: ShowType
  status: ShowStatus
  rating: number | null
  lgbtq_rep: LgbtqRep
  /** Owner-supplied dynasty (Chinese titles only); validated against `DYNASTIES`, else null. */
  dynasty: Dynasty | null
  watched_seasons: number | null
  /**
   * Episodes watched, or the literal `'all'` (watching/dropped episodic rows only) meaning "all
   * episodes of the last-watched season" — resolved against TMDB's per-season counts in `buildImportRow`.
   */
  watched_episodes: number | 'all' | null
  is_favorite: boolean
  /** Date the title was started. Required except for a `want` row, where it may be null. */
  start_date: IsoDate | null
  /** Finish / drop date — set only for finished rows (watched/dropped), else null. */
  end_date: IsoDate | null
  /** Optional free-text notes (right-most column); null when blank. */
  notes: string | null
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
const dynastySet = new Set<string>(DYNASTIES)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Watched/dropped rows are "finished" — they carry a finish date (`end_date`). */
function isFinishedShowStatus(status: ShowStatus): boolean {
  return status === 'watched' || status === 'dropped'
}

function intOrNull(raw: string): number | null {
  const s = raw.trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/** Lenient truthy parse for a CSV boolean cell: `true/1/yes/y` (case-insensitive) ⇒ true. */
function parseBool(raw: string): boolean {
  return ['true', '1', 'yes', 'y'].includes(raw.trim().toLowerCase())
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
        `Row ${line} ("${title}"): type "${typeRaw}" must be tv, movie or documentary — skipped.`,
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

    const dynastyRaw = col(cells, 'dynasty')
    let dynasty: Dynasty | null = null
    if (dynastyRaw !== '') {
      if (!dynastySet.has(dynastyRaw)) {
        errors.push(
          `Row ${line} ("${title}"): dynasty "${dynastyRaw}" is not a recognised dynasty — skipped.`,
        )
        continue
      }
      dynasty = dynastyRaw as Dynasty
    }

    const watched_seasons = intOrNull(col(cells, 'watched_seasons'))
    const epRaw = col(cells, 'watched_episodes')
    let watched_episodes: number | 'all' | null
    if (epRaw.toLowerCase() === 'all') {
      // `all` ⇒ "all episodes of the last-watched season"; only meaningful for an episodic row
      // that's still in progress, and we need the season number to look the count up later.
      if (!usesEpisodes(type as ShowType)) {
        errors.push(
          `Row ${line} ("${title}"): watched_episodes "all" only applies to tv/documentary rows — skipped.`,
        )
        continue
      }
      if (status !== 'watching' && status !== 'dropped') {
        errors.push(
          `Row ${line} ("${title}"): watched_episodes "all" only applies to watching/dropped rows — skipped.`,
        )
        continue
      }
      if (watched_seasons == null || watched_seasons < 1) {
        errors.push(
          `Row ${line} ("${title}"): watched_episodes "all" needs a watched_seasons value — skipped.`,
        )
        continue
      }
      watched_episodes = 'all'
    } else {
      watched_episodes = intOrNull(epRaw)
    }

    // `start_date` is required except for a `want` row (not started yet), where it may be blank.
    const startRaw = col(cells, 'start_date')
    let start_date: IsoDate | null = null
    if (startRaw !== '') {
      if (!ISO_DATE.test(startRaw)) {
        errors.push(
          `Row ${line} ("${title}"): start_date "${startRaw}" must be a date (YYYY-MM-DD) — skipped.`,
        )
        continue
      }
      start_date = startRaw
    } else if (status !== 'want') {
      errors.push(
        `Row ${line} ("${title}"): start_date is required (YYYY-MM-DD) unless status is want — skipped.`,
      )
      continue
    }

    // `end_date` is required for finished rows; for in-progress/want rows any value is ignored.
    let end_date: IsoDate | null = null
    if (isFinishedShowStatus(status as ShowStatus)) {
      const endRaw = col(cells, 'end_date')
      if (!ISO_DATE.test(endRaw)) {
        errors.push(
          `Row ${line} ("${title}"): end_date "${endRaw}" is required (YYYY-MM-DD) for watched/dropped — skipped.`,
        )
        continue
      }
      end_date = endRaw
    }

    const notesRaw = col(cells, 'notes')

    out.push({
      title,
      type: type as ShowType,
      status: status as ShowStatus,
      rating,
      lgbtq_rep: lgbtq_rep as LgbtqRep,
      dynasty,
      watched_seasons,
      watched_episodes,
      is_favorite: parseBool(col(cells, 'is_favorite')),
      start_date,
      end_date,
      notes: notesRaw === '' ? null : notesRaw,
    })
  }

  return { rows: out, errors }
}

/**
 * Idempotency key — a row updates an existing show with the same case-insensitive title
 * (type-agnostic), so a re-import of the same title updates in place rather than duplicating.
 */
export function dedupKey(title: string): string {
  return title.trim().toLowerCase()
}

/**
 * Combine a parsed CSV row with its TMDB match (or null) into a `show` insert. `start_date` comes
 * from the CSV (may be null for a `want` row); `end_date` only for finished rows. When `start_date` is
 * set, `created_at` is frozen to it; when it's null (a not-yet-started `want`), `created_at` is left to
 * the DB default so it equals `updated_at` (= import time). Watched counts: `watched` ⇒ the TMDB totals;
 * `watching`/`dropped` (TV) ⇒ the CSV values, where a `watched_episodes` of `'all'` resolves to
 * the episode count of the last-watched season (from TMDB), or null if TMDB has no count for it;
 * `want` / movies ⇒ null.
 */
export function buildImportRow(
  input: ParsedShowRow,
  match: ShowMetadata | null,
): ImportShowRow {
  const episodic = usesEpisodes(input.type)
  let watched_seasons: number | null = null
  let watched_episodes: number | null = null
  if (episodic) {
    if (input.status === 'watched') {
      watched_seasons = match?.total_seasons ?? null
      watched_episodes = match?.total_episodes ?? null
    } else if (input.status === 'watching' || input.status === 'dropped') {
      watched_seasons = input.watched_seasons
      watched_episodes =
        input.watched_episodes === 'all'
          ? (match?.season_episode_counts?.[input.watched_seasons ?? -1] ?? null)
          : input.watched_episodes
    }
  }

  return {
    type: input.type,
    status: input.status,
    title: match?.title ?? input.title,
    rating: input.rating,
    lgbtq_rep: input.lgbtq_rep,
    // Dynasty is kept only for a Chinese title (consistent with the Entry form).
    dynasty: containsCjk(match?.title ?? input.title) ? input.dynasty : null,
    is_favorite: input.is_favorite,
    original_title: match?.original_title ?? null,
    year: match?.year ?? null,
    poster_path: match?.poster_path ?? null,
    overview: match?.overview ?? null,
    genres: match?.genres ?? null,
    director: match?.director ?? null,
    cast: match?.cast ?? null,
    runtime_min: match?.runtime_min ?? null,
    original_language: match?.original_language ?? null,
    total_seasons: episodic ? (match?.total_seasons ?? null) : null,
    total_episodes: episodic ? (match?.total_episodes ?? null) : null,
    watched_seasons,
    watched_episodes,
    tmdb_id: match?.tmdb_id ?? null,
    imdb_id: match?.imdb_id ?? null,
    start_date: input.start_date,
    end_date: input.end_date,
    // Freeze created_at to start_date; when absent (a `want` row), let it default to now() = updated_at.
    ...(input.start_date ? { created_at: `${input.start_date}T00:00:00Z` } : {}),
    notes: input.notes,
  }
}
