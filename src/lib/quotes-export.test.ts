import { describe, expect, it } from 'vitest'
import { buildQuotesExportRows } from './quotes-export'
import type { QuoteRow } from './quotes'

function makeQuote(overrides: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id: 'q1',
    user_id: 'u1',
    text: 'Be yourself.',
    author: 'Oscar Wilde',
    source_type: 'book',
    title: 'De Profundis',
    category: 'wit',
    tags: [],
    language: 'en',
    is_favorite: false,
    show_id: null,
    book_id: null,
    text_norm: null,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    ...overrides,
  }
}

describe('buildQuotesExportRows', () => {
  it('emits the header row matching the importer column spec', () => {
    expect(buildQuotesExportRows([])).toEqual([
      [
        'Quote',
        'Author',
        'Source',
        'Title',
        'Category',
        'Tags',
        'is_favorite',
        'created_at',
      ],
    ])
  })

  it('emits one row per quote with all columns', () => {
    const rows = buildQuotesExportRows([makeQuote()])
    expect(rows[1]).toEqual([
      'Be yourself.',
      'Oscar Wilde',
      'book',
      'De Profundis',
      'wit',
      '',
      '',
      '2026-01-15',
    ])
  })

  it('exports source_type and category as stored keys, not display labels', () => {
    const rows = buildQuotesExportRows([
      makeQuote({ source_type: 'tv', category: 'growth' }),
    ])
    expect(rows[1]?.[2]).toBe('tv')
    expect(rows[1]?.[4]).toBe('growth')
  })

  it('exports null author/title as an empty string', () => {
    const rows = buildQuotesExportRows([makeQuote({ author: null, title: null })])
    expect(rows[1]?.[1]).toBe('')
    expect(rows[1]?.[3]).toBe('')
  })

  it('joins multiple tags with a comma-space separator', () => {
    const rows = buildQuotesExportRows([makeQuote({ tags: ['wisdom', 'humility'] })])
    expect(rows[1]?.[5]).toBe('wisdom, humility')
  })

  it('exports is_favorite as "true" only when true, else empty', () => {
    const favRows = buildQuotesExportRows([makeQuote({ is_favorite: true })])
    expect(favRows[1]?.[6]).toBe('true')
    const notFavRows = buildQuotesExportRows([makeQuote({ is_favorite: false })])
    expect(notFavRows[1]?.[6]).toBe('')
  })

  it('truncates created_at to a YYYY-MM-DD date', () => {
    const rows = buildQuotesExportRows([
      makeQuote({ created_at: '2025-11-03T00:00:00Z' }),
    ])
    expect(rows[1]?.[7]).toBe('2025-11-03')
  })

  it('sorts by created_at ascending, regardless of input order', () => {
    const rows = buildQuotesExportRows([
      makeQuote({ text: 'B', created_at: '2026-02-01T00:00:00Z' }),
      makeQuote({ text: 'A', created_at: '2026-01-01T00:00:00Z' }),
      makeQuote({ text: 'C', created_at: '2026-03-01T00:00:00Z' }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual(['A', 'B', 'C'])
  })

  it('breaks a created_at tie by author ascending', () => {
    const rows = buildQuotesExportRows([
      makeQuote({ text: 'B', author: 'Zed', created_at: '2026-01-01T00:00:00Z' }),
      makeQuote({ text: 'A', author: 'Ann', created_at: '2026-01-01T00:00:00Z' }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual(['A', 'B'])
  })

  it('breaks a created_at + author tie by title ascending', () => {
    const rows = buildQuotesExportRows([
      makeQuote({
        text: 'B',
        author: 'Ann',
        title: 'Zebra',
        created_at: '2026-01-01T00:00:00Z',
      }),
      makeQuote({
        text: 'A',
        author: 'Ann',
        title: 'Apple',
        created_at: '2026-01-01T00:00:00Z',
      }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual(['A', 'B'])
  })

  it('sorts a null author/title before any non-null value', () => {
    const rows = buildQuotesExportRows([
      makeQuote({
        text: 'Has author',
        author: 'Ann',
        created_at: '2026-01-01T00:00:00Z',
      }),
      makeQuote({ text: 'No author', author: null, created_at: '2026-01-01T00:00:00Z' }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual(['No author', 'Has author'])
  })
})
