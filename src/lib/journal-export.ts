/**
 * Pure row-building for the Journal CSV export — the inverse of `journal-import.ts`'s
 * `parseJournalCsv`. Column spec matches exactly: `day,journal_entry,mood,tags`, so a file
 * produced here re-imports unchanged via Import CSV Journal. `mood` is exported as its stored key
 * (not the display label) — the importer matches a row's `mood` cell against either the key or
 * label, so the key stays correct even if the mood was later renamed in Journal Values. Rows are
 * sorted here by `day` ascending (oldest first) for export readability — `listJournalEntries`
 * itself stays newest-first, since that's the Journal Library's display order. No I/O.
 */
import type { JournalRow } from './journal'

const HEADER = ['day', 'journal_entry', 'mood', 'tags']

export function buildJournalExportRows(entries: JournalRow[]): string[][] {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day))
  const rows: string[][] = [HEADER]
  for (const e of sorted) {
    rows.push([e.day, e.journal_entry, e.mood, e.tags.join(', ')])
  }
  return rows
}
