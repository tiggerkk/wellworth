import { describe, expect, it } from 'vitest'
import { buildImportRow, dedupKey, parseBooksCsv } from './books-import'
import type { BookMetadata } from './books-api'

const HEADER = [
  'title',
  'author',
  'status',
  'rating',
  'lgbtq_rep',
  'is_favorite',
  'start_date',
  'end_date',
  'notes',
]

describe('parseBooksCsv', () => {
  it('reports a missing required column', () => {
    const res = parseBooksCsv([['title', 'rating']])
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatch(/missing required column/i)
  })

  it('parses a valid Read row and defaults blank lgbtq_rep to none', () => {
    const res = parseBooksCsv([
      HEADER,
      ['Dune', 'Frank Herbert', 'read', '5', '', 'true', '2026-02-01', '2026-03-01'],
    ])
    expect(res.errors).toEqual([])
    expect(res.rows[0]).toEqual({
      title: 'Dune',
      author: 'Frank Herbert',
      status: 'read',
      rating: 5,
      lgbtq_rep: 'none',
      dynasty: null,
      is_favorite: true,
      start_date: '2026-02-01',
      end_date: '2026-03-01',
      notes: null,
    })
  })

  it('reads a multi-line notes cell and treats a blank notes cell as null', () => {
    const res = parseBooksCsv([
      HEADER,
      [
        'A',
        'X',
        'read',
        '',
        '',
        '',
        '2026-02-01',
        '2026-03-01',
        'first line\nsecond line',
      ],
      ['B', 'Y', 'read', '', '', '', '2026-02-01', '2026-03-01', ''],
    ])
    expect(res.errors).toEqual([])
    expect(res.rows[0]?.notes).toBe('first line\nsecond line')
    expect(res.rows[1]?.notes).toBeNull()
  })

  it('imports a non-Read status (Want needs only start_date)', () => {
    const res = parseBooksCsv([
      HEADER,
      ['Solo', 'Author', 'want', '', '', '', '2026-02-01'],
    ])
    expect(res.errors).toEqual([])
    expect(res.rows[0]).toMatchObject({
      status: 'want',
      start_date: '2026-02-01',
      end_date: null,
    })
    expect(res.rows[0]?.is_favorite).toBe(false)
  })

  it('allows a blank start_date for a want row (created_at defaults to now())', () => {
    const res = parseBooksCsv([HEADER, ['Solo', 'Author', 'want', '', '', '', '', '']])
    expect(res.errors).toEqual([])
    expect(res.rows[0]).toMatchObject({
      status: 'want',
      start_date: null,
      end_date: null,
    })
  })

  it('rejects an unknown status', () => {
    const res = parseBooksCsv([HEADER, ['A', 'X', 'maybe', '', '', '', '2026-02-01']])
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatch(/status/i)
  })

  it('requires start_date, and end_date for finished (read/dropped) rows', () => {
    const res = parseBooksCsv([
      HEADER,
      ['A', 'X', 'read', '', '', '', '', '2026-03-01'], // missing start_date
      ['B', 'Y', 'read', '', '', '', '2026-02-01', ''], // read needs end_date
    ])
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatch(/start_date/i)
    expect(res.errors[1]).toMatch(/end_date/i)
  })

  it('skips rows missing title or author', () => {
    const res = parseBooksCsv([HEADER, ['', 'Someone'], ['Untitled', '']])
    expect(res.rows).toHaveLength(0)
    expect(res.errors).toHaveLength(2)
  })

  it('rejects a bad rating', () => {
    const res = parseBooksCsv([
      HEADER,
      ['A', 'X', 'read', '6', '', '', '2026-02-01', '2026-03-01'],
    ])
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatch(/rating/i)
  })

  it('rejects an unknown lgbtq_rep', () => {
    const res = parseBooksCsv([
      HEADER,
      ['A', 'X', 'read', '', 'lots', '', '2026-02-01', '2026-03-01'],
    ])
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatch(/lgbtq_rep/i)
  })

  it('treats a blank rating as null and ignores end_date for an unfinished row', () => {
    const res = parseBooksCsv([
      HEADER,
      ['Solo', 'Author', 'reading', '', 'some', '', '2026-02-01', ''],
    ])
    expect(res.rows[0]).toMatchObject({ rating: null, end_date: null, lgbtq_rep: 'some' })
  })
})

describe('dedupKey', () => {
  it('is case/space-insensitive over title + author', () => {
    expect(dedupKey('  Dune ', 'Frank HERBERT')).toBe('dune|frank herbert')
  })
  it('handles a missing author', () => {
    expect(dedupKey('Dune', null)).toBe('dune|')
    expect(dedupKey('Dune', undefined)).toBe('dune|')
  })
})

describe('buildImportRow', () => {
  const input = {
    title: 'dune',
    author: 'frank herbert',
    status: 'read' as const,
    rating: 4.5,
    lgbtq_rep: 'none' as const,
    dynasty: null,
    is_favorite: true,
    start_date: '2026-02-01',
    end_date: '2026-03-01',
    notes: 'Loved it.',
  }

  it('uses the Google Books match and carries status + CSV dates (created_at = start_date)', () => {
    const match: BookMetadata = {
      title: 'Dune',
      authors: ['Frank Herbert'],
      year: 1965,
      cover_url: 'https://x/dune.jpg',
      description: 'Desert planet.',
      genres: ['Science Fiction'],
      page_count: 412,
      language: 'en',
      isbn: '9780441013593',
      google_books_id: 'gid1',
      open_library_id: null,
    }
    expect(buildImportRow(input, match)).toEqual({
      status: 'read',
      title: 'Dune',
      authors: ['Frank Herbert'],
      year: 1965,
      cover_url: 'https://x/dune.jpg',
      description: 'Desert planet.',
      genres: ['Science Fiction'],
      page_count: 412,
      language: 'en',
      isbn: '9780441013593',
      google_books_id: 'gid1',
      open_library_id: null,
      rating: 4.5,
      lgbtq_rep: 'none',
      dynasty: null,
      is_favorite: true,
      start_date: '2026-02-01',
      end_date: '2026-03-01',
      created_at: '2026-02-01T00:00:00Z',
      notes: 'Loved it.',
    })
  })

  it('falls back to the CSV title/author with null metadata on no match', () => {
    const row = buildImportRow(input, null)
    expect(row).toMatchObject({
      status: 'read',
      title: 'dune',
      authors: ['frank herbert'],
      year: null,
      cover_url: null,
      google_books_id: null,
      rating: 4.5,
      start_date: '2026-02-01',
      end_date: '2026-03-01',
      created_at: '2026-02-01T00:00:00Z',
    })
  })

  it('a want row with no start_date omits created_at (defaults to now() = updated_at)', () => {
    const row = buildImportRow(
      { ...input, status: 'want', start_date: null, end_date: null },
      null,
    )
    expect(row.start_date).toBeNull()
    expect(row.created_at).toBeUndefined()
  })
})
