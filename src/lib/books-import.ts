/**
 * Pure parsing + validation + row-building for the Books CSV import (see
 * `templates/books-import-guide.md`). No I/O and no Google Books calls — the import screen reads the
 * file, resolves each row against Google Books, and writes via `saveImportedBooks`.
 *
 * Column spec: `title,author,rating,lgbtq_rep,dynasty,end_date,is_favorite`. Every imported row is a **Read** book;
 * the per-row lookup uses title **and** author to disambiguate (book titles collide far more than shows).
 */
import { LGBTQ_REPS, type BookInsert, type LgbtqRep } from './books'
import type { BookMetadata } from './books-api'
import type { IsoDate } from './date'
import { containsCjk } from './cjk'
import { DYNASTIES, type Dynasty } from '../constants/dynasty'

const REQUIRED_COLUMNS = ['title', 'author']

export interface ParsedBookRow {
  title: string
  author: string
  rating: number | null
  lgbtq_rep: LgbtqRep
  /** Owner-supplied dynasty (Chinese titles only); validated against `DYNASTIES`, else null. */
  dynasty: Dynasty | null
  end_date: IsoDate | null
  is_favorite: boolean
}

export interface BooksImportResult {
  rows: ParsedBookRow[]
  errors: string[]
}

/** The `book` insert fields produced from a CSV row + its Google Books match (user_id added by the data layer). */
export type ImportBookRow = Omit<BookInsert, 'user_id'>

const lgbtqSet = new Set<string>(LGBTQ_REPS)
const dynastySet = new Set<string>(DYNASTIES)
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

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

    const endRaw = col(cells, 'end_date')
    let end_date: IsoDate | null = null
    if (endRaw !== '') {
      if (!ISO_DATE.test(endRaw)) {
        errors.push(
          `Row ${line} ("${title}"): end_date "${endRaw}" must be YYYY-MM-DD — skipped.`,
        )
        continue
      }
      end_date = endRaw
    }

    out.push({
      title,
      author,
      rating,
      lgbtq_rep: lgbtq_rep as LgbtqRep,
      dynasty,
      end_date,
      is_favorite: parseBool(col(cells, 'is_favorite')),
    })
  }

  return { rows: out, errors }
}

/** Idempotency key — a row updates an existing book with the same case-insensitive title + author. */
export function dedupKey(title: string, author: string | null | undefined): string {
  return `${title.trim().toLowerCase()}|${(author ?? '').trim().toLowerCase()}`
}

/**
 * Combine a parsed CSV row with its Google Books match (or null) into a `book` insert. Every imported
 * row is **Read**; `start_date` and `last_update_date` are left NULL (genuinely unknown), `end_date`
 * comes from the file. A no-match row keeps the CSV title/author with null metadata so the owner can
 * fix it later (open → search → select).
 */
export function buildImportRow(
  input: ParsedBookRow,
  match: BookMetadata | null,
): ImportBookRow {
  return {
    status: 'read',
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
    start_date: null,
    end_date: input.end_date,
    last_update_date: null,
    comments: null,
  }
}
