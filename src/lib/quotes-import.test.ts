import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { defaultCategories, defaultSourceTypes } from './quotes-config'
import {
  buildImportPayload,
  buildTitleIndex,
  parseQuotesCsv,
  partitionNewRows,
  resolveLink,
  type ParsedQuoteRow,
} from './quotes-import'

const HEADER = 'Quote,Author,Source,Title,Category,Tags,is_favorite,created_at'
const SRC = defaultSourceTypes()
const CATS = defaultCategories()
const parse = (csv: string) => parseQuotesCsv(parseCsv(csv), SRC, CATS)

describe('parseQuotesCsv', () => {
  it('parses a simple valid row (tags split, language en)', () => {
    const { rows, errors } = parse(
      `${HEADER}\nWork harder on yourself.,Jim Rohn,video,Best Life,Growth,"discipline, success",,2026-01-01`,
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      text: 'Work harder on yourself.',
      author: 'Jim Rohn',
      source_type: 'video',
      title: 'Best Life',
      category: 'growth',
      tags: ['discipline', 'success'],
      language: 'en',
      created_at: '2026-01-01',
      text_norm: 'work harder on yourself.',
    })
  })

  it('requires a valid created_at date', () => {
    expect(parse(`${HEADER}\nA quote,,tv,T,Wit,,,`).errors).toHaveLength(1) // blank
    expect(parse(`${HEADER}\nA quote,,tv,T,Wit,,,03/01/2026`).errors).toHaveLength(1) // malformed
  })

  it('handles embedded commas, escaped quotes, and multi-line quoted cells', () => {
    const csv = `${HEADER}
"Almost everything will work again, including you.",Anne Lamott,video,12 Things,Philosophy,"zen, perspective",,2026-01-01
"""You said autonomy."" ""I said empower.""",Francis Underwood,tv,House of Cards,Growth,leadership,,2026-01-01
"Moira: Who put a ghost on my desk?
Roland: That's the sonogram!",Moira Rose,tv,Schitt's Creek,Wit,"clever, irony",,2026-01-01`
    const { rows, errors } = parse(csv)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text).toContain(', including you')
    expect(rows[1]!.text).toContain('"You said autonomy."')
    expect(rows[2]!.text).toBe(
      "Moira: Who put a ghost on my desk?\nRoland: That's the sonogram!",
    )
    expect(rows[2]!.tags).toEqual(['clever', 'irony'])
  })

  it('parses a trailing is_favorite flag (else false)', () => {
    const { rows } = parse(
      `${HEADER}\nFav line,A,tv,T,Wit,,yes,2026-01-01\nPlain line,A,tv,T,Wit,,,2026-01-01`,
    )
    expect(rows[0]!.is_favorite).toBe(true)
    expect(rows[1]!.is_favorite).toBe(false)
  })

  it('auto-detects Chinese from CJK text', () => {
    const { rows } = parse(
      `${HEADER}\n知者不惑,Confucius,book,Analects,Philosophy,wisdom,,2026-01-01`,
    )
    expect(rows[0]!.language).toBe('zh')
  })

  it('matches Source/Category by label too (not just key)', () => {
    const { rows, errors } = parse(
      `${HEADER}\nA quote,,TV Show,,Observation,,,2026-01-01`,
    )
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ source_type: 'tv', category: 'observation' })
  })

  it('flags blank/invalid category, unknown source, and empty quote with line numbers', () => {
    const csv = `${HEADER}
Good quote,A,tv,T,NotACategory,
Another,A,clipboard,T,Wit,
,A,tv,T,Wit,`
    const { rows, errors } = parse(csv)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(3)
    expect(errors[0]).toContain('Row 2')
    expect(errors[0]).toContain('Category')
    expect(errors[1]).toContain('Row 3')
    expect(errors[1]).toContain('Source')
    expect(errors[2]).toContain('Row 4')
    expect(errors[2]).toContain('missing Quote')
  })

  it('errors on a missing required column', () => {
    const { errors } = parse('Quote,Author,Title,Tags\nx,y,z,w')
    expect(errors[0]).toContain('Missing required column')
  })

  it('normalises category/source case and treats blank author/title as null', () => {
    const { rows } = parse(`${HEADER}\nA quote,,TV,,WIT,,,2026-01-01`)
    expect(rows[0]).toMatchObject({
      author: null,
      title: null,
      source_type: 'tv',
      category: 'wit',
      tags: [],
    })
  })
})

const row = (text: string): ParsedQuoteRow => ({
  text,
  author: null,
  source_type: 'tv',
  title: null,
  category: 'wit',
  tags: [],
  language: 'en',
  is_favorite: false,
  created_at: '2026-01-01',
  text_norm: text.trim().toLowerCase(),
})

describe('partitionNewRows', () => {
  it('skips rows already in the existing set', () => {
    const { newRows, duplicates } = partitionNewRows(
      [row('Keep me'), row('Already here')],
      new Set(['already here']),
    )
    expect(newRows.map((r) => r.text)).toEqual(['Keep me'])
    expect(duplicates).toBe(1)
  })

  it('collapses in-file duplicates (first wins)', () => {
    const { newRows, duplicates } = partitionNewRows(
      [row('Same'), row('Same'), row('Other')],
      new Set(),
    )
    expect(newRows.map((r) => r.text)).toEqual(['Same', 'Other'])
    expect(duplicates).toBe(1)
  })
})

describe('resolveLink / buildTitleIndex', () => {
  const index = buildTitleIndex(
    [{ id: 'show-1', title: 'House of Cards' }],
    [{ id: 'book-1', title: 'Dune' }],
  )

  it('links tv/movie to a Show by title', () => {
    expect(resolveLink('tv', 'House of Cards', index, SRC)).toEqual({
      show_id: 'show-1',
      book_id: null,
    })
    expect(resolveLink('movie', 'house of cards', index, SRC).show_id).toBe('show-1')
  })

  it('links book to a Book by title', () => {
    expect(resolveLink('book', 'Dune', index, SRC)).toEqual({
      show_id: null,
      book_id: 'book-1',
    })
  })

  it('does not link other source types or unmatched titles', () => {
    expect(resolveLink('song', 'House of Cards', index, SRC)).toEqual({
      show_id: null,
      book_id: null,
    })
    expect(resolveLink('tv', 'Unknown Show', index, SRC).show_id).toBeNull()
    expect(resolveLink('tv', null, index, SRC).show_id).toBeNull()
  })

  it('buildImportPayload applies the link + carries is_favorite through', () => {
    const payload = buildImportPayload(
      { ...row('A line'), source_type: 'tv', title: 'House of Cards', is_favorite: true },
      index,
      SRC,
    )
    expect(payload).toMatchObject({
      show_id: 'show-1',
      book_id: null,
      is_favorite: true,
      created_at: '2026-01-01T00:00:00Z',
    })
  })
})
