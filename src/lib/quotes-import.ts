/**
 * Pure parsing + validation + idempotency helpers for the Quotes CSV import (see
 * `templates/quotes-import-guide.md`). No I/O and no external API — the import screen reads the file
 * (via the shared RFC-4180 `parseCsv`), resolves each row's Title against the user's local Show/Book
 * rows, and writes via `saveImportedQuotes`.
 *
 * Column spec: `Quote,Author,Source,Title,Category,Tags,is_favorite,created_at`. Quote + Category are
 * required; Source + Category must match one of the owner's configured Source Type / Category values
 * (by key OR label, case-insensitive — the values are configurable in Quotes Settings); Tags is a
 * single (quoted) cell of comma-separated tags; is_favorite is an optional trailing boolean
 * (`true/1/yes/y`); `created_at` (required, YYYY-MM-DD) is the date the quote is recorded under and
 * drives the Library/Zen "Date" sort (`updated_at` is left to the DB).
 */
import { detectLanguage, type QuoteInsert } from './quotes'
import {
  linkKindFor,
  matchKeyOrLabel,
  type QuoteCategoryConfig,
  type QuoteSourceTypeConfig,
} from './quotes-config'
import type { IsoDate } from './date'
import type { QuoteLanguage } from '../constants/quotes'

const REQUIRED_COLUMNS = ['quote', 'source', 'category']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface ParsedQuoteRow {
  text: string
  author: string | null
  // Configurable keys resolved from the owner's lists (see quotes-config.ts).
  source_type: string
  title: string | null
  category: string
  tags: string[]
  language: QuoteLanguage
  is_favorite: boolean
  /** Date the quote is recorded under (drives the "Date" sort); frozen onto `created_at`. */
  created_at: IsoDate
  /** lower(trim(text)) — the app-side replica of the DB's generated `text_norm`. */
  text_norm: string
}

/** Lenient truthy parse for a CSV boolean cell: `true/1/yes/y` (case-insensitive) ⇒ true. */
function parseBool(raw: string): boolean {
  return ['true', '1', 'yes', 'y'].includes(raw.trim().toLowerCase())
}

export interface QuotesImportResult {
  rows: ParsedQuoteRow[]
  errors: string[]
}

/** App-side replica of the DB generated column `text_norm = lower(btrim(text))`. */
export function normalizeQuoteText(text: string): string {
  return text.trim().toLowerCase()
}

export function parseQuotesCsv(
  rows: string[][],
  sourceTypes: QuoteSourceTypeConfig[],
  categories: QuoteCategoryConfig[],
): QuotesImportResult {
  const errors: string[] = []
  const out: ParsedQuoteRow[] = []
  const categoryLabels = categories.map((c) => c.label).join('/')
  const sourceLabels = sourceTypes.map((s) => s.label).join('/')

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

    const text = col(cells, 'quote')
    if (text === '') {
      errors.push(`Row ${line}: missing Quote — skipped.`)
      continue
    }

    const categoryKey = matchKeyOrLabel(categories, col(cells, 'category'))
    if (!categoryKey) {
      errors.push(
        `Row ${line}: Category "${col(cells, 'category')}" must be one of ${categoryLabels} — skipped.`,
      )
      continue
    }

    const sourceKey = matchKeyOrLabel(sourceTypes, col(cells, 'source'))
    if (!sourceKey) {
      errors.push(
        `Row ${line}: Source "${col(cells, 'source')}" must be one of ${sourceLabels} — skipped.`,
      )
      continue
    }

    const createdRaw = col(cells, 'created_at')
    if (!ISO_DATE.test(createdRaw)) {
      errors.push(
        `Row ${line}: created_at "${createdRaw}" must be a date (YYYY-MM-DD) — skipped.`,
      )
      continue
    }

    const author = col(cells, 'author') || null
    const title = col(cells, 'title') || null
    // Tags is one (quoted) cell of comma-separated tags: read the whole cell, THEN split on `,`.
    const tags = col(cells, 'tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    out.push({
      text,
      author,
      source_type: sourceKey,
      title,
      category: categoryKey,
      tags,
      language: detectLanguage(text),
      is_favorite: parseBool(col(cells, 'is_favorite')),
      created_at: createdRaw,
      text_norm: normalizeQuoteText(text),
    })
  }

  return { rows: out, errors }
}

/**
 * Split parsed rows into the new ones to insert vs a duplicate count. A row is a duplicate if its
 * `text_norm` is already in the user's existing quotes **or** earlier in this same file (first
 * occurrence wins) — so the batch handed to the DB has no in-file conflicts.
 */
export function partitionNewRows(
  rows: ParsedQuoteRow[],
  existingNorms: Set<string>,
): { newRows: ParsedQuoteRow[]; duplicates: number } {
  const seen = new Set<string>()
  const newRows: ParsedQuoteRow[] = []
  let duplicates = 0
  for (const row of rows) {
    if (existingNorms.has(row.text_norm) || seen.has(row.text_norm)) {
      duplicates += 1
      continue
    }
    seen.add(row.text_norm)
    newRows.push(row)
  }
  return { newRows, duplicates }
}

export interface TitleIndex {
  showIdByTitle: Map<string, string>
  bookIdByTitle: Map<string, string>
}

/** Build lowercased-title → id lookups from the user's local Show/Book rows (first title wins). */
export function buildTitleIndex(
  shows: { id: string; title: string }[],
  books: { id: string; title: string }[],
): TitleIndex {
  const showIdByTitle = new Map<string, string>()
  for (const s of shows) {
    const key = s.title.trim().toLowerCase()
    if (key && !showIdByTitle.has(key)) showIdByTitle.set(key, s.id)
  }
  const bookIdByTitle = new Map<string, string>()
  for (const b of books) {
    const key = b.title.trim().toLowerCase()
    if (key && !bookIdByTitle.has(key)) bookIdByTitle.set(key, b.id)
  }
  return { showIdByTitle, bookIdByTitle }
}

/**
 * Resolve an optional Show/Book link by the source type's configured `linkKind` (show → Show, book →
 * Book, null → neither). Custom source types link to neither, exactly like the old non-tv/movie/book case.
 */
export function resolveLink(
  sourceType: string,
  title: string | null,
  index: TitleIndex,
  sourceTypes: QuoteSourceTypeConfig[],
): { show_id: string | null; book_id: string | null } {
  if (!title) return { show_id: null, book_id: null }
  const key = title.trim().toLowerCase()
  const kind = linkKindFor(sourceTypes, sourceType)
  if (kind === 'show') {
    return { show_id: index.showIdByTitle.get(key) ?? null, book_id: null }
  }
  if (kind === 'book') {
    return { show_id: null, book_id: index.bookIdByTitle.get(key) ?? null }
  }
  return { show_id: null, book_id: null }
}

/**
 * The `quote` insert fields produced from a parsed row (user_id + generated text_norm added later).
 * `created_at` IS supplied (frozen from the CSV); `updated_at` is left to the DB.
 */
export type QuoteImportPayload = Omit<
  QuoteInsert,
  'user_id' | 'text_norm' | 'id' | 'updated_at'
>

/** Combine a parsed row with its resolved local link into a `quote` insert payload. */
export function buildImportPayload(
  row: ParsedQuoteRow,
  index: TitleIndex,
  sourceTypes: QuoteSourceTypeConfig[],
): QuoteImportPayload {
  const { show_id, book_id } = resolveLink(row.source_type, row.title, index, sourceTypes)
  return {
    text: row.text,
    author: row.author,
    source_type: row.source_type,
    title: row.title,
    category: row.category,
    tags: row.tags,
    language: row.language,
    is_favorite: row.is_favorite,
    created_at: `${row.created_at}T00:00:00Z`,
    show_id,
    book_id,
  }
}
