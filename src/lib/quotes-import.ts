/**
 * Pure parsing + validation + idempotency helpers for the Quotes CSV import (see
 * `templates/quotes-import-guide.md`). No I/O and no external API — the import screen reads the file
 * (via the shared RFC-4180 `parseCsv`), resolves each row's Title against the user's local Show/Book
 * rows, and writes via `saveImportedQuotes`.
 *
 * Column spec: `Quote,Author,Source,Title,Category,Tags,is_favorite`. Quote + Category are required;
 * Source must normalise to the seven source types; Tags is a single (quoted) cell of comma-separated
 * tags; is_favorite is an optional trailing boolean (`true/1/yes/y`).
 */
import { detectLanguage, type QuoteInsert } from './quotes'
import {
  QUOTE_CATEGORIES,
  QUOTE_SOURCE_TYPES,
  type QuoteCategory,
  type QuoteLanguage,
  type QuoteSourceType,
} from '../constants/quotes'

const REQUIRED_COLUMNS = ['quote', 'source', 'category']

const categorySet = new Set<string>(QUOTE_CATEGORIES)
const sourceSet = new Set<string>(QUOTE_SOURCE_TYPES)

export interface ParsedQuoteRow {
  text: string
  author: string | null
  source_type: QuoteSourceType
  title: string | null
  category: QuoteCategory
  tags: string[]
  language: QuoteLanguage
  is_favorite: boolean
  /** lower(trim(text)) — the app-side mirror of the DB's generated `text_norm`. */
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

/** App-side mirror of the DB generated column `text_norm = lower(btrim(text))`. */
export function normalizeQuoteText(text: string): string {
  return text.trim().toLowerCase()
}

export function parseQuotesCsv(rows: string[][]): QuotesImportResult {
  const errors: string[] = []
  const out: ParsedQuoteRow[] = []

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

    const categoryRaw = col(cells, 'category').toLowerCase()
    if (!categorySet.has(categoryRaw)) {
      errors.push(
        `Row ${line}: Category "${col(cells, 'category')}" must be one of ${QUOTE_CATEGORIES.join('/')} — skipped.`,
      )
      continue
    }

    const sourceRaw = col(cells, 'source').toLowerCase()
    if (!sourceSet.has(sourceRaw)) {
      errors.push(
        `Row ${line}: Source "${col(cells, 'source')}" must be one of ${QUOTE_SOURCE_TYPES.join('/')} — skipped.`,
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
      source_type: sourceRaw as QuoteSourceType,
      title,
      category: categoryRaw as QuoteCategory,
      tags,
      language: detectLanguage(text),
      is_favorite: parseBool(col(cells, 'is_favorite')),
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

/** Resolve an optional Show/Book link by source type (tv/movie → Show, book → Book, else neither). */
export function resolveLink(
  sourceType: QuoteSourceType,
  title: string | null,
  index: TitleIndex,
): { show_id: string | null; book_id: string | null } {
  if (!title) return { show_id: null, book_id: null }
  const key = title.trim().toLowerCase()
  if (sourceType === 'tv' || sourceType === 'movie') {
    return { show_id: index.showIdByTitle.get(key) ?? null, book_id: null }
  }
  if (sourceType === 'book') {
    return { show_id: null, book_id: index.bookIdByTitle.get(key) ?? null }
  }
  return { show_id: null, book_id: null }
}

/** The `quote` insert fields produced from a parsed row (user_id + generated text_norm added later). */
export type QuoteImportPayload = Omit<
  QuoteInsert,
  'user_id' | 'text_norm' | 'id' | 'created_at' | 'updated_at'
>

/** Combine a parsed row with its resolved local link into a `quote` insert payload. */
export function buildImportPayload(
  row: ParsedQuoteRow,
  index: TitleIndex,
): QuoteImportPayload {
  const { show_id, book_id } = resolveLink(row.source_type, row.title, index)
  return {
    text: row.text,
    author: row.author,
    source_type: row.source_type,
    title: row.title,
    category: row.category,
    tags: row.tags,
    language: row.language,
    is_favorite: row.is_favorite,
    show_id,
    book_id,
  }
}
