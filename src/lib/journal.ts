/**
 * Journal domain helpers — UI-framework-free so they're unit-tested and shared by Journal
 * screens. DB access lives in `src/data/journal.ts`. Journal is folded into the Quotes module
 * (own table `journal_entry`, own tag vocabulary) rather than a standalone module.
 */
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'
import type { IsoDate } from './date'
import { foldZh } from './zh-fold'

export type JournalRow = Tables<'journal_entry'>
export type JournalInsert = TablesInsert<'journal_entry'>
export type JournalUpdate = TablesUpdate<'journal_entry'>

export type JournalSortField = 'date'
export type JournalSortDir = 'asc' | 'desc'

export interface JournalCriteria {
  query: string
  /** Multi-select tags, OR semantics: an entry matches if it has ANY selected tag. */
  tags: string[]
  dateFrom: IsoDate | null
  dateTo: IsoDate | null
  /** A mood key, or 'all' (the 7 moods are fixed — see `JOURNAL_MOODS` — but the value is kept as
   *  a plain string here, same tolerant shape as Quotes' `category: 'all' | string`). */
  mood: 'all' | string
  sortField: JournalSortField
  sortDir: JournalSortDir
}

export const DEFAULT_JOURNAL_CRITERIA: JournalCriteria = {
  query: '',
  tags: [],
  dateFrom: null,
  dateTo: null,
  mood: 'all',
  sortField: 'date',
  sortDir: 'desc',
}

/** Folded text the Journal search matches: entry text + tags. Traditional⇄Simplified agnostic. */
export function journalSearchText(e: Pick<JournalRow, 'journal_entry' | 'tags'>): string {
  return foldZh([e.journal_entry, ...(e.tags ?? [])].filter(Boolean).join(' '))
}

/**
 * Distinct tags with their entry counts — the Tags-facet source (derived, no DB call). Sorted by
 * **count desc, then tag asc** so the most-used tags surface first.
 */
export function rankedJournalTags(
  entries: Pick<JournalRow, 'tags'>[],
): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const e of entries)
    for (const t of e.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * Filter then sort a Journal list. Only sortable by date (`day`) — see `JournalSortField`. Pure;
 * does not mutate `entries`.
 */
export function applyJournalView(
  entries: JournalRow[],
  c: JournalCriteria,
): JournalRow[] {
  const q = foldZh(c.query.trim())
  return entries
    .filter((e) => {
      if (q && !journalSearchText(e).includes(q)) return false
      if (c.tags.length > 0 && !c.tags.some((t) => e.tags.includes(t))) return false
      if (c.mood !== 'all' && e.mood !== c.mood) return false
      if (c.dateFrom && e.day < c.dateFrom) return false
      if (c.dateTo && e.day > c.dateTo) return false
      return true
    })
    .sort((a, b) =>
      c.sortDir === 'asc' ? a.day.localeCompare(b.day) : b.day.localeCompare(a.day),
    )
}
