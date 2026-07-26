/**
 * Pure parsing + validation helpers for the Journal CSV import. No I/O and no external API — the
 * import screen reads the file (via the shared RFC-4180 `parseCsv`) and writes via
 * `saveImportedJournalEntries`.
 *
 * Column spec: `day,journal_entry,mood,tags`. day (required, YYYY-MM-DD) is the calendar day the
 * entry belongs to and — since `journal_entry` is a day-based table (UNIQUE(user_id, day)) — also
 * the value frozen onto both `created_at` and `updated_at`. journal_entry is required. mood is
 * optional (matched case-insensitively against a mood's key or label); a blank or unrecognized
 * cell defaults to 'neutral' with a flagged warning (not a skipped row — the row still imports).
 * Tags is a single (quoted) cell of comma-separated tags.
 */
import { JOURNAL_MOOD_DEFAULT_KEY } from '../constants/journal'
import {
  defaultMoods,
  matchMoodKeyOrLabel,
  type JournalMoodConfig,
} from './journal-moods'
import type { JournalInsert } from './journal'
import type { IsoDate } from './date'

const REQUIRED_COLUMNS = ['day', 'journal_entry']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface ParsedJournalRow {
  day: IsoDate
  journal_entry: string
  mood: string
  tags: string[]
}

export interface JournalImportResult {
  rows: ParsedJournalRow[]
  errors: string[]
}

/** `moods` defaults to the canonical 7 (key/label match) — pass the owner's `effectiveMoods()`
 *  result instead when available, so a renamed mood's label still matches in the CSV. */
export function parseJournalCsv(
  rows: string[][],
  moods: JournalMoodConfig[] = defaultMoods(),
): JournalImportResult {
  const errors: string[] = []
  const out: ParsedJournalRow[] = []

  if (rows.length === 0) return { rows: out, errors: ['The file is empty.'] }

  const header = rows[0]!.map((h) => h.trim().toLowerCase())
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) {
    return { rows: out, errors: [`Missing required column(s): ${missing.join(', ')}.`] }
  }
  const hasMoodColumn = header.includes('mood')

  const col = (cells: string[], name: string): string => {
    const idx = header.indexOf(name)
    return idx === -1 ? '' : (cells[idx] ?? '').trim()
  }

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!
    if (cells.every((c) => c.trim() === '')) continue // skip blank lines
    const line = r + 1 // 1-based spreadsheet row (header is line 1)

    const day = col(cells, 'day')
    if (!ISO_DATE.test(day)) {
      errors.push(`Row ${line}: day "${day}" must be a date (YYYY-MM-DD) — skipped.`)
      continue
    }

    const journalEntry = col(cells, 'journal_entry')
    if (journalEntry === '') {
      errors.push(`Row ${line}: missing journal_entry — skipped.`)
      continue
    }

    let mood = JOURNAL_MOOD_DEFAULT_KEY
    if (hasMoodColumn) {
      const raw = col(cells, 'mood')
      const matched = raw ? matchMoodKeyOrLabel(moods, raw) : null
      if (matched) {
        mood = matched
      } else if (raw) {
        errors.push(`Row ${line}: mood "${raw}" not recognized — defaulted to Neutral.`)
      }
    }

    // Tags is one (quoted) cell of comma-separated tags: read the whole cell, THEN split on `,`.
    const tags = col(cells, 'tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    out.push({ day, journal_entry: journalEntry, mood, tags })
  }

  return { rows: out, errors }
}

/**
 * Split parsed rows into the new ones to insert vs a duplicate count. A row is a duplicate if its
 * day is already in the user's existing entries **or** earlier in this same file (first
 * occurrence wins) — so the batch handed to the DB has no in-file conflicts.
 */
export function partitionNewJournalRows(
  rows: ParsedJournalRow[],
  existingDays: Set<IsoDate>,
): { newRows: ParsedJournalRow[]; duplicates: number } {
  const seen = new Set<IsoDate>()
  const newRows: ParsedJournalRow[] = []
  let duplicates = 0
  for (const row of rows) {
    if (existingDays.has(row.day) || seen.has(row.day)) {
      duplicates += 1
      continue
    }
    seen.add(row.day)
    newRows.push(row)
  }
  return { newRows, duplicates }
}

/**
 * The `journal_entry` insert fields produced from a parsed row (user_id added later).
 * `created_at`/`updated_at` are both frozen to the CSV's `day` (per the day-based table model).
 */
export type JournalImportPayload = Omit<JournalInsert, 'user_id' | 'id'>

export function buildJournalImportPayload(row: ParsedJournalRow): JournalImportPayload {
  return {
    day: row.day,
    journal_entry: row.journal_entry,
    mood: row.mood,
    tags: row.tags,
    created_at: `${row.day}T00:00:00Z`,
    updated_at: `${row.day}T00:00:00Z`,
  }
}
