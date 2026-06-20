import { describe, expect, it } from 'vitest'
import { buildImportRow, dedupKey, parseBooksCsv } from './books-import'
import type { BookMetadata } from './books-api'

const HEADER = ['title', 'author', 'rating', 'lgbtq_rep', 'end_date']

describe('parseBooksCsv', () => {
  it('reports a missing required column', () => {
    const res = parseBooksCsv([['title', 'rating']])
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatch(/missing required column/i)
  })

  it('parses a valid row and defaults blank lgbtq_rep to none', () => {
    const res = parseBooksCsv([HEADER, ['Dune', 'Frank Herbert', '5', '', '2026-03-01']])
    expect(res.errors).toEqual([])
    expect(res.rows[0]).toEqual({
      title: 'Dune',
      author: 'Frank Herbert',
      rating: 5,
      lgbtq_rep: 'none',
      end_date: '2026-03-01',
    })
  })

  it('skips rows missing title or author', () => {
    const res = parseBooksCsv([
      HEADER,
      ['', 'Someone', '', '', ''],
      ['Untitled', '', '', '', ''],
    ])
    expect(res.rows).toHaveLength(0)
    expect(res.errors).toHaveLength(2)
  })

  it('rejects a bad rating and a bad end_date', () => {
    const res = parseBooksCsv([
      HEADER,
      ['A', 'X', '6', '', ''],
      ['B', 'Y', '', '', '03/01/2026'],
    ])
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatch(/rating/i)
    expect(res.errors[1]).toMatch(/end_date/i)
  })

  it('rejects an unknown lgbtq_rep', () => {
    const res = parseBooksCsv([HEADER, ['A', 'X', '', 'lots', '']])
    expect(res.rows).toHaveLength(0)
    expect(res.errors[0]).toMatch(/lgbtq_rep/i)
  })

  it('treats blank rating + end_date as null', () => {
    const res = parseBooksCsv([HEADER, ['Solo', 'Author', '', 'some', '']])
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
    rating: 4.5,
    lgbtq_rep: 'none' as const,
    end_date: '2026-03-01',
  }

  it('uses the Google Books match and is always status read with NULL start/last-update', () => {
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
      start_date: null,
      end_date: '2026-03-01',
      last_update_date: null,
      comments: null,
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
      end_date: '2026-03-01',
      start_date: null,
      last_update_date: null,
    })
  })
})
