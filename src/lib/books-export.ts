/**
 * Pure row-building for the Books CSV export — the inverse of `books-import.ts`'s
 * `parseBooksCsv`. Column spec matches exactly:
 * `title,author,status,rating,lgbtq_rep,dynasty,is_favorite,start_date,end_date,notes`, so a file
 * produced here re-imports unchanged via Import CSV Books. Reuses `listBooks` directly — its
 * list-screen column selection is already a superset of every export column, so no dedicated
 * data-layer query is needed. `author` joins the stored `authors` array with `, ` — the importer
 * treats the whole cell as one opaque lookup string, so a multi-author cell round-trips fine
 * (quoted automatically by `toCsv` since it contains a comma).
 *
 * Rows are sorted here by `status` (canonical enum order, not alphabetically — `BOOK_STATUSES`),
 * then `start_date` ascending (null last, for `want` rows that haven't started) — `listBooks`
 * itself stays newest-touched-first (`updated_at` desc), since that's the Books Library's
 * display order. No I/O.
 */
import { BOOK_STATUSES } from '../constants/books'
import type { BookRow } from './books'

const HEADER = [
  'title',
  'author',
  'status',
  'rating',
  'lgbtq_rep',
  'dynasty',
  'is_favorite',
  'start_date',
  'end_date',
  'notes',
]

const statusOrder = new Map<string, number>(BOOK_STATUSES.map((s, i) => [s, i]))

/** status (enum order), then start_date asc (null last). */
function compareForExport(a: BookRow, b: BookRow): number {
  const byStatus =
    (statusOrder.get(a.status) ?? BOOK_STATUSES.length) -
    (statusOrder.get(b.status) ?? BOOK_STATUSES.length)
  if (byStatus !== 0) return byStatus
  if (a.start_date == null && b.start_date == null) return 0
  if (a.start_date == null) return 1
  if (b.start_date == null) return -1
  return a.start_date.localeCompare(b.start_date)
}

function numOrEmpty(n: number | null): string {
  return n == null ? '' : String(n)
}

export function buildBooksExportRows(books: BookRow[]): string[][] {
  const sorted = [...books].sort(compareForExport)
  const rows: string[][] = [HEADER]
  for (const b of sorted) {
    rows.push([
      b.title,
      (b.authors ?? []).join(', '),
      b.status,
      numOrEmpty(b.rating),
      b.lgbtq_rep,
      b.dynasty ?? '',
      b.is_favorite ? 'true' : '',
      b.start_date ?? '',
      b.end_date ?? '',
      b.notes ?? '',
    ])
  }
  return rows
}
