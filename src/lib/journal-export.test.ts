import { describe, expect, it } from 'vitest'
import { buildJournalExportRows } from './journal-export'
import type { JournalRow } from './journal'

function makeEntry(overrides: Partial<JournalRow> = {}): JournalRow {
  return {
    id: 'e1',
    user_id: 'u1',
    day: '2026-01-15',
    journal_entry: 'A good day.',
    mood: 'content',
    tags: [],
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    ...overrides,
  }
}

describe('buildJournalExportRows', () => {
  it('emits the header row matching the importer column spec', () => {
    expect(buildJournalExportRows([])).toEqual([['day', 'journal_entry', 'mood', 'tags']])
  })

  it('emits one row per entry with day/journal_entry/mood/tags', () => {
    const rows = buildJournalExportRows([
      makeEntry({
        day: '2026-01-15',
        journal_entry: 'Hello',
        mood: 'happy',
        tags: ['work'],
      }),
    ])
    expect(rows).toEqual([
      ['day', 'journal_entry', 'mood', 'tags'],
      ['2026-01-15', 'Hello', 'happy', 'work'],
    ])
  })

  it('joins multiple tags with a comma-space separator', () => {
    const rows = buildJournalExportRows([
      makeEntry({ tags: ['work', 'family', 'health'] }),
    ])
    expect(rows[1]?.[3]).toBe('work, family, health')
  })

  it('exports an empty string for no tags', () => {
    const rows = buildJournalExportRows([makeEntry({ tags: [] })])
    expect(rows[1]?.[3]).toBe('')
  })

  it('exports the mood as its stored key, not a display label', () => {
    const rows = buildJournalExportRows([makeEntry({ mood: 'anxious' })])
    expect(rows[1]?.[2]).toBe('anxious')
  })

  it('sorts rows by day ascending, regardless of input order', () => {
    const rows = buildJournalExportRows([
      makeEntry({ day: '2026-01-15' }),
      makeEntry({ day: '2026-01-10' }),
      makeEntry({ day: '2026-01-20' }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual([
      '2026-01-10',
      '2026-01-15',
      '2026-01-20',
    ])
  })
})
