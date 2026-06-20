import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import {
  buildImportPayload,
  buildTitleIndex,
  parseQuotesCsv,
  partitionNewRows,
  resolveLink,
  type ParsedQuoteRow,
} from './quotes-import'

const HEADER = 'Quote,Author,Source,Title,Category,Tags'

describe('parseQuotesCsv', () => {
  it('parses a simple valid row (tags split, language en)', () => {
    const { rows, errors } = parseQuotesCsv(
      parseCsv(
        `${HEADER}\nWork harder on yourself.,Jim Rohn,video,Best Life,Growth,"discipline, success"`,
      ),
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
      text_norm: 'work harder on yourself.',
    })
  })

  it('handles embedded commas, escaped quotes, and multi-line quoted cells', () => {
    const csv = `${HEADER}
"Almost everything will work again, including you.",Anne Lamott,video,12 Things,Philosophy,"zen, perspective"
"""You said autonomy."" ""I said empower.""",Francis Underwood,tv,House of Cards,Growth,leadership
"Moira: Who put a ghost on my desk?
Roland: That's the sonogram!",Moira Rose,tv,Schitt's Creek,Wit,"clever, irony"`
    const { rows, errors } = parseQuotesCsv(parseCsv(csv))
    expect(errors).toEqual([])
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text).toContain(', including you')
    expect(rows[1]!.text).toContain('"You said autonomy."')
    expect(rows[2]!.text).toBe(
      "Moira: Who put a ghost on my desk?\nRoland: That's the sonogram!",
    )
    expect(rows[2]!.tags).toEqual(['clever', 'irony'])
  })

  it('auto-detects Chinese from CJK text', () => {
    const { rows } = parseQuotesCsv(
      parseCsv(`${HEADER}\n知者不惑,Confucius,book,Analects,Philosophy,wisdom`),
    )
    expect(rows[0]!.language).toBe('zh')
  })

  it('flags blank/invalid category, unknown source, and empty quote with line numbers', () => {
    const csv = `${HEADER}
Good quote,A,tv,T,NotACategory,
Another,A,clipboard,T,Wit,
,A,tv,T,Wit,`
    const { rows, errors } = parseQuotesCsv(parseCsv(csv))
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
    const { errors } = parseQuotesCsv(parseCsv('Quote,Author,Title,Tags\nx,y,z,w'))
    expect(errors[0]).toContain('Missing required column')
  })

  it('normalises category/source case and treats blank author/title as null', () => {
    const { rows } = parseQuotesCsv(parseCsv(`${HEADER}\nA quote,,TV,,WIT,`))
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
    expect(resolveLink('tv', 'House of Cards', index)).toEqual({
      show_id: 'show-1',
      book_id: null,
    })
    expect(resolveLink('movie', 'house of cards', index).show_id).toBe('show-1')
  })

  it('links book to a Book by title', () => {
    expect(resolveLink('book', 'Dune', index)).toEqual({
      show_id: null,
      book_id: 'book-1',
    })
  })

  it('does not link other source types or unmatched titles', () => {
    expect(resolveLink('song', 'House of Cards', index)).toEqual({
      show_id: null,
      book_id: null,
    })
    expect(resolveLink('tv', 'Unknown Show', index).show_id).toBeNull()
    expect(resolveLink('tv', null, index).show_id).toBeNull()
  })

  it('buildImportPayload applies the link + defaults is_favorite false', () => {
    const payload = buildImportPayload(
      { ...row('A line'), source_type: 'tv', title: 'House of Cards' },
      index,
    )
    expect(payload).toMatchObject({
      show_id: 'show-1',
      book_id: null,
      is_favorite: false,
    })
  })
})
