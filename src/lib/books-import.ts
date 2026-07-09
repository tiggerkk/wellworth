/**
 * Pure parsing + validation + row-building for the Books CSV import (see
 * `templates/books-import-guide.md`). No I/O and no Google Books calls — the import screen reads the
 * file, resolves each row against Google Books, and writes via `saveImportedBooks`.
 *
 * Column spec: `title,author,status,rating,lgbtq_rep,dynasty,is_favorite,start_date,end_date,notes`.
 * `status` is want/reading/read/dropped; `start_date` is required on every row; `end_date` is required
 * for finished rows (read/dropped) and ignored otherwise; `notes` is the optional, nullable right-most
 * column (free text; wrap multi-line values in quotes); `created_at` is frozen to `start_date`
 * (`updated_at` is left to the DB). The per-row lookup uses title **and** author to disambiguate
 * (book titles collide far more than shows).
 */
import { type BookInsert } from '../lib/books'
import { type BookStatus, type LgbtqRep } from '../lib/books'
import { BOOK_STATUSES, LGBTQ_REPS } from '../constants/books'
import type { BookMetadata } from './books-api'
import type { IsoDate } from './date'
import { containsCjk } from './cjk'
import { DYNASTIES, type Dynasty } from '../constants/dynasty'

const REQUIRED_COLUMNS = ['title', 'author']

export interface ParsedBookRow {
  title: string
  author: string
  status: BookStatus
  rating: number | null
  lgbtq_rep: LgbtqRep
  /** Owner-supplied dynasty (Chinese titles only); validated against `DYNASTIES`, else null. */
  dynasty: Dynasty | null
  is_favorite: boolean
  /** Date the book was started. Required except for a `want` row, where it may be null. */
  start_date: IsoDate | null
  /** Finish / drop date — set only for finished rows (read/dropped), else null. */
  end_date: IsoDate | null
  /** Optional free-text notes (right-most column); null when blank. */
  notes: string | null
}

export interface BooksImportResult {
  rows: ParsedBookRow[]
  errors: string[]
}

/** The `book` insert fields produced from a CSV row + its Google Books match (user_id added by the data layer). */
export type ImportBookRow = Omit<BookInsert, 'user_id'>

const statusSet = new Set<string>(BOOK_STATUSES)
const lgbtqSet = new Set<string>(LGBTQ_REPS)
const dynastySet = new Set<string>(DYNASTIES)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Read/dropped rows are "finished" — they carry a finish date (`end_date`). */
function isFinishedBookStatus(status: BookStatus): boolean {
  return status === 'read' || status === 'dropped'
}

/** Lenient truthy parse for a CSV boolean cell: `true/1/yes/y` (case-insensitive) ⇒ true. */
function parseBool(raw: string): boolean {
  return ['true', '1', 'yes', 'y'].includes(raw.trim().toLowerCase())
}

export function parseBooksCsv(rows: string[][]): BooksImportResult {
  const errors: string[] = []
  const out: ParsedBookRow[] = []

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
    const author = col(cells, 'author')
    if (title === '' || author === '') {
      errors.push(`Row ${line}: missing title or author — skipped.`)
      continue
    }

    const statusRaw = col(cells, 'status')
    const status = statusRaw.toLowerCase()
    if (!statusSet.has(status)) {
      errors.push(
        `Row ${line} ("${title}"): status "${statusRaw}" must be want/reading/read/dropped — skipped.`,
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

    // `end_date` is required for finished rows; for reading/want rows any value is ignored.
    let end_date: IsoDate | null = null
    if (isFinishedBookStatus(status as BookStatus)) {
      const endRaw = col(cells, 'end_date')
      if (!ISO_DATE.test(endRaw)) {
        errors.push(
          `Row ${line} ("${title}"): end_date "${endRaw}" is required (YYYY-MM-DD) for read/dropped — skipped.`,
        )
        continue
      }
      end_date = endRaw
    }

    const notesRaw = col(cells, 'notes')

    out.push({
      title,
      author,
      status: status as BookStatus,
      rating,
      lgbtq_rep: lgbtq_rep as LgbtqRep,
      dynasty,
      is_favorite: parseBool(col(cells, 'is_favorite')),
      start_date,
      end_date,
      notes: notesRaw === '' ? null : notesRaw,
    })
  }

  return { rows: out, errors }
}

/** Idempotency key — a row updates an existing book with the same case-insensitive title + author. */
export function dedupKey(title: string, author: string | null | undefined): string {
  return `${title.trim().toLowerCase()}|${(author ?? '').trim().toLowerCase()}`
}

/**
 * Combine a parsed CSV row with its Google Books match (or null) into a `book` insert. `status` comes
 * from the CSV; `start_date` may be null for a `want` row; `end_date` only for finished rows. When
 * `start_date` is set, `created_at` is frozen to it; when it's null (a not-yet-started `want`),
 * `created_at` is left to the DB default so it equals `updated_at` (= import time). A no-match row keeps
 * the CSV title/author with null metadata so the owner can fix it later (open → search → select).
 */
export function buildImportRow(
  input: ParsedBookRow,
  match: BookMetadata | null,
): ImportBookRow {
  return {
    status: input.status,
    title: match?.title ?? input.title,
    authors: match?.authors ?? [input.author],
    year: match?.year ?? null,
    cover_url: match?.cover_url ?? null,
    description: match?.description ?? null,
    genres: match?.genres ?? null,
    page_count: match?.page_count ?? null,
    language: match?.language ?? null,
    isbn: match?.isbn ?? null,
    google_books_id: match?.google_books_id ?? null,
    open_library_id: match?.open_library_id ?? null,
    rating: input.rating,
    lgbtq_rep: input.lgbtq_rep,
    // Dynasty is kept only for a Chinese title (consistent with the Entry form).
    dynasty: containsCjk(match?.title ?? input.title) ? input.dynasty : null,
    is_favorite: input.is_favorite,
    start_date: input.start_date,
    end_date: input.end_date,
    // Freeze created_at to start_date; when absent (a `want` row), let it default to now() = updated_at.
    ...(input.start_date ? { created_at: `${input.start_date}T00:00:00Z` } : {}),
    notes: input.notes,
  }
}
