/**
 * Pure row-building for the Quotes CSV export — the inverse of `quotes-import.ts`'s
 * `parseQuotesCsv`. Column spec matches exactly: `Quote,Author,Source,Title,Category,Tags,
 * is_favorite,created_at`, so a file produced here re-imports unchanged via Import CSV Quotes.
 * `Source`/`Category` are exported as their stored keys (not display labels) — the importer
 * matches either, and the key stays correct even if a Source Type/Category was later renamed in
 * Quotes Settings. `Title` is exported verbatim from the quote row (it's stored as plain text,
 * independent of the show_id/book_id auto-link). Rows are sorted here by created_at, then author,
 * then title — `listQuotes` itself stays newest-touched-first (`updated_at` desc), since that's
 * the Quotes Library's display order. No I/O.
 */
import type { QuoteRow } from './quotes'

const HEADER = [
  'Quote',
  'Author',
  'Source',
  'Title',
  'Category',
  'Tags',
  'is_favorite',
  'created_at',
]

/** created_at asc, then author asc (nulls last), then title asc (nulls last). */
function compareForExport(a: QuoteRow, b: QuoteRow): number {
  const byDate = a.created_at.localeCompare(b.created_at)
  if (byDate !== 0) return byDate
  const byAuthor = (a.author ?? '').localeCompare(b.author ?? '')
  if (byAuthor !== 0) return byAuthor
  return (a.title ?? '').localeCompare(b.title ?? '')
}

export function buildQuotesExportRows(quotes: QuoteRow[]): string[][] {
  const sorted = [...quotes].sort(compareForExport)
  const rows: string[][] = [HEADER]
  for (const q of sorted) {
    rows.push([
      q.text,
      q.author ?? '',
      q.source_type,
      q.title ?? '',
      q.category,
      q.tags.join(', '),
      q.is_favorite ? 'true' : '',
      q.created_at.slice(0, 10),
    ])
  }
  return rows
}
