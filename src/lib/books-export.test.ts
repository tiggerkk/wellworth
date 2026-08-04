import { describe, expect, it } from 'vitest'
import { buildBooksExportRows } from './books-export'
import type { BookRow } from './books'

function makeBook(overrides: Partial<BookRow> = {}): BookRow {
  return {
    id: 'b1',
    user_id: 'u1',
    title: 'Book Title',
    authors: ['Author One'],
    status: 'read',
    rating: null,
    lgbtq_rep: 'none',
    dynasty: null,
    is_favorite: false,
    start_date: '2026-01-01',
    end_date: '2026-01-10',
    notes: null,
    isbn: null,
    google_books_id: null,
    open_library_id: null,
    cover_url: null,
    description: null,
    genres: null,
    language: null,
    page_count: null,
    year: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    ...overrides,
  }
}

describe('buildBooksExportRows', () => {
  it('emits the header row matching the importer column spec', () => {
    expect(buildBooksExportRows([])).toEqual([
      [
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
      ],
    ])
  })

  it('emits one row per book with all columns', () => {
    const rows = buildBooksExportRows([
      makeBook({
        title: 'Dune',
        authors: ['Frank Herbert'],
        status: 'read',
        rating: 5,
        lgbtq_rep: 'none',
        dynasty: null,
        is_favorite: true,
        start_date: '2025-01-01',
        end_date: '2025-01-20',
        notes: 'Reread',
      }),
    ])
    expect(rows[1]).toEqual([
      'Dune',
      'Frank Herbert',
      'read',
      '5',
      'none',
      '',
      'true',
      '2025-01-01',
      '2025-01-20',
      'Reread',
    ])
  })

  it('joins multiple authors with a comma-space separator', () => {
    const rows = buildBooksExportRows([makeBook({ authors: ['Author A', 'Author B'] })])
    expect(rows[1]?.[1]).toBe('Author A, Author B')
  })

  it('exports a null authors array as an empty string', () => {
    const rows = buildBooksExportRows([makeBook({ authors: null })])
    expect(rows[1]?.[1]).toBe('')
  })

  it('exports null rating as an empty string', () => {
    const rows = buildBooksExportRows([makeBook({ rating: null })])
    expect(rows[1]?.[3]).toBe('')
  })

  it('exports null dynasty/notes/dates as empty strings, is_favorite false as empty', () => {
    const rows = buildBooksExportRows([
      makeBook({
        dynasty: null,
        notes: null,
        start_date: null,
        end_date: null,
        is_favorite: false,
      }),
    ])
    expect(rows[1]?.[5]).toBe('')
    expect(rows[1]?.[6]).toBe('')
    expect(rows[1]?.[7]).toBe('')
    expect(rows[1]?.[8]).toBe('')
    expect(rows[1]?.[9]).toBe('')
  })

  it('sorts by status in canonical enum order (want, reading, read, dropped), not alphabetically', () => {
    const rows = buildBooksExportRows([
      makeBook({ title: 'Dropped one', status: 'dropped' }),
      makeBook({ title: 'Want one', status: 'want' }),
      makeBook({ title: 'Reading one', status: 'reading' }),
      makeBook({ title: 'Read one', status: 'read' }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual([
      'Want one',
      'Reading one',
      'Read one',
      'Dropped one',
    ])
  })

  it('breaks a status tie by start_date ascending', () => {
    const rows = buildBooksExportRows([
      makeBook({ title: 'Later', status: 'read', start_date: '2026-03-01' }),
      makeBook({ title: 'Earlier', status: 'read', start_date: '2026-01-01' }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual(['Earlier', 'Later'])
  })

  it('sorts a null start_date after any dated row within the same status', () => {
    const rows = buildBooksExportRows([
      makeBook({ title: 'No date', status: 'want', start_date: null }),
      makeBook({ title: 'Has date', status: 'want', start_date: '2026-01-01' }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual(['Has date', 'No date'])
  })
})
