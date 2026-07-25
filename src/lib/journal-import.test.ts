import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import {
  buildJournalImportPayload,
  parseJournalCsv,
  partitionNewJournalRows,
  type ParsedJournalRow,
} from './journal-import'

const HEADER = 'day,journal_entry,tags'
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
      tags: ['a', 'b'],
    })
  })

  it('returns an error for an empty file', () => {
    expect(parse('').errors).toEqual(['The file is empty.'])
  })
})

describe('partitionNewJournalRows', () => {
  const rows: ParsedJournalRow[] = [
    { day: '2026-06-13', journal_entry: 'A', tags: [] },
    { day: '2026-06-12', journal_entry: 'B', tags: [] },
    { day: '2026-06-12', journal_entry: 'B again — in-file dup', tags: [] },
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
      tags: ['rest'],
    })
    expect(payload).toEqual({
      day: '2026-06-13',
      journal_entry: 'Rested.',
      tags: ['rest'],
      created_at: '2026-06-13T00:00:00Z',
      updated_at: '2026-06-13T00:00:00Z',
    })
  })
})
