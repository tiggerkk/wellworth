/**
 * Pure row-building for the Shows CSV export — the inverse of `shows-import.ts`'s
 * `parseShowsCsv`. Column spec matches exactly:
 * `title,type,status,rating,lgbtq_rep,dynasty,watched_seasons,watched_episodes,is_favorite,
 * start_date,end_date,notes`, so a file produced here re-imports unchanged via Import CSV Shows.
 * Reuses `listShows` directly — its list-screen column selection is already a superset of every
 * export column, so no dedicated data-layer query is needed.
 *
 * Rows are sorted here by `type`, then `status` (both by their canonical enum order, not
 * alphabetically — `SHOW_TYPES`/`SHOW_STATUSES`), then `start_date` ascending (null last, for
 * `want` rows that haven't started) — `listShows` itself stays newest-touched-first
 * (`updated_at` desc), since that's the Shows Library's display order. No I/O.
 */
import { SHOW_TYPES, SHOW_STATUSES } from '../constants/shows'
import type { ShowRow } from './shows'

const HEADER = [
  'title',
  'type',
  'status',
  'rating',
  'lgbtq_rep',
  'dynasty',
  'watched_seasons',
  'watched_episodes',
  'is_favorite',
  'start_date',
  'end_date',
  'notes',
]

const typeOrder = new Map<string, number>(SHOW_TYPES.map((t, i) => [t, i]))
const statusOrder = new Map<string, number>(SHOW_STATUSES.map((s, i) => [s, i]))

/** type (enum order), then status (enum order), then start_date asc (null last). */
function compareForExport(a: ShowRow, b: ShowRow): number {
  const byType =
    (typeOrder.get(a.type) ?? SHOW_TYPES.length) -
    (typeOrder.get(b.type) ?? SHOW_TYPES.length)
  if (byType !== 0) return byType
  const byStatus =
    (statusOrder.get(a.status) ?? SHOW_STATUSES.length) -
    (statusOrder.get(b.status) ?? SHOW_STATUSES.length)
  if (byStatus !== 0) return byStatus
  if (a.start_date == null && b.start_date == null) return 0
  if (a.start_date == null) return 1
  if (b.start_date == null) return -1
  return a.start_date.localeCompare(b.start_date)
}

function numOrEmpty(n: number | null): string {
  return n == null ? '' : String(n)
}

export function buildShowsExportRows(shows: ShowRow[]): string[][] {
  const sorted = [...shows].sort(compareForExport)
  const rows: string[][] = [HEADER]
  for (const s of sorted) {
    rows.push([
      s.title,
      s.type,
      s.status,
      numOrEmpty(s.rating),
      s.lgbtq_rep,
      s.dynasty ?? '',
      numOrEmpty(s.watched_seasons),
      numOrEmpty(s.watched_episodes),
      s.is_favorite ? 'true' : '',
      s.start_date ?? '',
      s.end_date ?? '',
      s.notes ?? '',
    ])
  }
  return rows
}
