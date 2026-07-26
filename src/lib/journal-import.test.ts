import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import {
  buildJournalImportPayload,
  parseJournalCsv,
  partitionNewJournalRows,
  type ParsedJournalRow,
} from './journal-import'
import { defaultMoods, renameMood } from './journal-moods'

const HEADER = 'day,journal_entry,tags'
const MOOD_HEADER = 'day,journal_entry,mood,tags'
const parse = (csv: string) => parseJournalCsv(parseCsv(csv))

describe('parseJournalCsv', () => {
  it('parses a simple valid row (tags split)', () => {
    const { rows, errors } = parse(
      `${HEADER}\n2026-06-13,Rested for less than a week.,"work, rest"`,
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      day: '2026-06-13',
      journal_entry: 'Rested for less than a week.',
      mood: 'neutral',
      tags: ['work', 'rest'],
    })
  })

  it('defaults tags to an empty array when the cell is blank', () => {
    const { rows, errors } = parse(`${HEADER}\n2026-06-13,No tags today,`)
    expect(errors).toEqual([])
    expect(rows[0]?.tags).toEqual([])
  })

  it('requires a valid day (YYYY-MM-DD)', () => {
    expect(parse(`${HEADER}\n,Some text,`).errors).toHaveLength(1) // blank
    expect(parse(`${HEADER}\n06/13/2026,Some text,`).errors).toHaveLength(1) // malformed
    expect(parse(`${HEADER}\n2026-6-13,Some text,`).errors).toHaveLength(1) // not zero-padded
  })

  it('requires a non-blank journal_entry', () => {
    expect(parse(`${HEADER}\n2026-06-13,,`).errors).toHaveLength(1)
  })

  it('skips blank lines without erroring', () => {
    const { rows, errors } = parse(
      `${HEADER}\n2026-06-13,Entry one,\n\n2026-06-12,Entry two,`,
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(2)
  })

  it('reports missing required columns', () => {
    const { errors } = parse('journal_entry,tags\nOnly text,')
    expect(errors).toEqual(['Missing required column(s): day.'])
  })

  it('is column-order independent', () => {
    const { rows, errors } = parse('tags,day,journal_entry\n"a, b",2026-06-13,Some text')
    expect(errors).toEqual([])
    expect(rows[0]).toEqual({
      day: '2026-06-13',
      journal_entry: 'Some text',
      mood: 'neutral',
      tags: ['a', 'b'],
    })
  })

  it('returns an error for an empty file', () => {
    expect(parse('').errors).toEqual(['The file is empty.'])
  })

  it('defaults mood to neutral when the column is absent', () => {
    const { rows, errors } = parse(`${HEADER}\n2026-06-13,No mood column,`)
    expect(errors).toEqual([])
    expect(rows[0]?.mood).toBe('neutral')
  })

  describe('with a mood column', () => {
    it('matches a canonical mood key, case-insensitively', () => {
      const { rows, errors } = parse(`${MOOD_HEADER}\n2026-06-13,Great day,HAPPY,`)
      expect(errors).toEqual([])
      expect(rows[0]?.mood).toBe('happy')
    })

    it('matches a mood by its owner-renamed label when that config is passed in', () => {
      const renamed = renameMood(defaultMoods(), 'happy', 'Joyful')
      const withoutConfig = parseJournalCsv(
        parseCsv(`${MOOD_HEADER}\n2026-06-13,Great day,Joyful,`),
      )
      const withConfig = parseJournalCsv(
        parseCsv(`${MOOD_HEADER}\n2026-06-13,Great day,Joyful,`),
        renamed,
      )
      // Against the canonical (unrenamed) defaults, "Joyful" isn't recognized.
      expect(withoutConfig.rows[0]?.mood).toBe('neutral')
      expect(withoutConfig.errors.length).toBeGreaterThan(0)
      // Against the owner's renamed config, "Joyful" resolves to the "happy" key.
      expect(withConfig.rows[0]?.mood).toBe('happy')
      expect(withConfig.errors).toEqual([])
    })

    it('defaults to neutral with a warning for an unrecognized mood, without skipping the row', () => {
      const { rows, errors } = parse(`${MOOD_HEADER}\n2026-06-13,Great day,ecstatic,`)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.mood).toBe('neutral')
      expect(errors).toEqual([
        'Row 2: mood "ecstatic" not recognized — defaulted to Neutral.',
      ])
    })

    it('defaults to neutral without a warning when the cell is blank', () => {
      const { rows, errors } = parse(`${MOOD_HEADER}\n2026-06-13,Great day,,`)
      expect(rows[0]?.mood).toBe('neutral')
      expect(errors).toEqual([])
    })
  })
})

describe('partitionNewJournalRows', () => {
  const rows: ParsedJournalRow[] = [
    { day: '2026-06-13', journal_entry: 'A', mood: 'neutral', tags: [] },
    { day: '2026-06-12', journal_entry: 'B', mood: 'neutral', tags: [] },
    {
      day: '2026-06-12',
      journal_entry: 'B again — in-file dup',
      mood: 'neutral',
      tags: [],
    },
  ]

  it('treats a day already in the DB as a duplicate', () => {
    const { newRows, duplicates } = partitionNewJournalRows(rows, new Set(['2026-06-13']))
    expect(newRows.map((r) => r.day)).toEqual(['2026-06-12'])
    expect(duplicates).toBe(2) // the existing day + the in-file repeat
  })

  it('treats a repeated day within the file as a duplicate (first occurrence wins)', () => {
    const { newRows, duplicates } = partitionNewJournalRows(rows, new Set())
    expect(newRows.map((r) => r.journal_entry)).toEqual(['A', 'B'])
    expect(duplicates).toBe(1)
  })
})

describe('buildJournalImportPayload', () => {
  it('freezes created_at/updated_at to the row day', () => {
    const payload = buildJournalImportPayload({
      day: '2026-06-13',
      journal_entry: 'Rested.',
      mood: 'calm',
      tags: ['rest'],
    })
    expect(payload).toEqual({
      day: '2026-06-13',
      journal_entry: 'Rested.',
      mood: 'calm',
      tags: ['rest'],
      created_at: '2026-06-13T00:00:00Z',
      updated_at: '2026-06-13T00:00:00Z',
    })
  })
})
