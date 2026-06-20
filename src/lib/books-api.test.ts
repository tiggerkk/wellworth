import { describe, expect, it } from 'vitest'
import {
  capGenres,
  httpsCover,
  mapGoogleSearchItems,
  mapGoogleVolume,
  mapOpenLibrarySearchDocs,
  mapOpenLibraryWork,
  olCoverUrl,
  pickIsbn,
  pickPublishYear,
  rankSearchResults,
  type BookSearchResult,
} from './books-api'

const hit = (p: Partial<BookSearchResult>): BookSearchResult => ({
  source: 'google',
  sourceId: p.title ?? 'x',
  title: 'Untitled',
  authors: null,
  year: null,
  coverUrl: null,
  ...p,
})

describe('pickPublishYear', () => {
  it('parses Google publishedDate in any granularity', () => {
    expect(pickPublishYear('1937')).toBe(1937)
    expect(pickPublishYear('1937-09')).toBe(1937)
    expect(pickPublishYear('1937-09-21')).toBe(1937)
  })
  it('accepts a numeric year (Open Library)', () => {
    expect(pickPublishYear(1965)).toBe(1965)
  })
  it('returns null for empty/invalid', () => {
    expect(pickPublishYear('')).toBeNull()
    expect(pickPublishYear(null)).toBeNull()
    expect(pickPublishYear(undefined)).toBeNull()
  })
})

describe('httpsCover', () => {
  it('upgrades http to https', () => {
    expect(httpsCover('http://books.google.com/img?id=1')).toBe(
      'https://books.google.com/img?id=1',
    )
  })
  it('leaves https untouched and nulls empties', () => {
    expect(httpsCover('https://x/y.jpg')).toBe('https://x/y.jpg')
    expect(httpsCover(null)).toBeNull()
    expect(httpsCover(undefined)).toBeNull()
  })
})

describe('pickIsbn', () => {
  it('prefers ISBN_13 over ISBN_10', () => {
    expect(
      pickIsbn([
        { type: 'ISBN_10', identifier: '0261103342' },
        { type: 'ISBN_13', identifier: '9780261103344' },
      ]),
    ).toBe('9780261103344')
  })
  it('falls back to ISBN_10', () => {
    expect(pickIsbn([{ type: 'ISBN_10', identifier: '0261103342' }])).toBe('0261103342')
  })
  it('returns null when none', () => {
    expect(pickIsbn(undefined)).toBeNull()
    expect(pickIsbn([{ type: 'OTHER', identifier: 'x' }])).toBeNull()
  })
})

describe('capGenres', () => {
  it('trims, drops empties, and caps the count', () => {
    const many = Array.from({ length: 12 }, (_, i) => `Genre ${i + 1}`)
    expect(capGenres(many)).toHaveLength(8)
    expect(capGenres([' Fantasy ', '', 'Adventure'])).toEqual(['Fantasy', 'Adventure'])
  })
  it('returns null when empty', () => {
    expect(capGenres(undefined)).toBeNull()
    expect(capGenres([])).toBeNull()
  })
})

describe('olCoverUrl', () => {
  it('builds a covers.openlibrary.org url', () => {
    expect(olCoverUrl(8231856, 'M')).toBe(
      'https://covers.openlibrary.org/b/id/8231856-M.jpg',
    )
  })
  it('returns null without a cover id', () => {
    expect(olCoverUrl(null, 'L')).toBeNull()
    expect(olCoverUrl(undefined, 'S')).toBeNull()
  })
})

describe('mapGoogleSearchItems', () => {
  it('maps volume items to search results', () => {
    expect(
      mapGoogleSearchItems({
        items: [
          {
            id: 'gid1',
            volumeInfo: {
              title: 'The Hobbit',
              authors: ['J.R.R. Tolkien'],
              publishedDate: '1937-09-21',
              imageLinks: { thumbnail: 'http://books.google.com/c.jpg' },
            },
          },
        ],
      }),
    ).toEqual([
      {
        source: 'google',
        sourceId: 'gid1',
        title: 'The Hobbit',
        authors: ['J.R.R. Tolkien'],
        year: 1937,
        coverUrl: 'https://books.google.com/c.jpg',
      },
    ])
  })
  it('handles missing items', () => {
    expect(mapGoogleSearchItems({})).toEqual([])
  })
})

describe('mapGoogleVolume', () => {
  it('maps a volume into our book columns', () => {
    expect(
      mapGoogleVolume({
        id: 'gid1',
        volumeInfo: {
          title: 'Dune',
          authors: ['Frank Herbert'],
          publishedDate: '1965',
          description: 'A desert planet.',
          pageCount: 412,
          categories: ['Fiction', 'Science Fiction'],
          language: 'en',
          imageLinks: { thumbnail: 'http://x/dune.jpg' },
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780441013593' }],
        },
      }),
    ).toEqual({
      title: 'Dune',
      authors: ['Frank Herbert'],
      year: 1965,
      cover_url: 'https://x/dune.jpg',
      description: 'A desert planet.',
      genres: ['Fiction', 'Science Fiction'],
      page_count: 412,
      language: 'en',
      isbn: '9780441013593',
      google_books_id: 'gid1',
      open_library_id: null,
    })
  })
})

describe('mapOpenLibrarySearchDocs', () => {
  it('maps docs, stripping the /works/ prefix and building a cover url', () => {
    expect(
      mapOpenLibrarySearchDocs({
        docs: [
          {
            key: '/works/OL45804W',
            title: 'Fantastic Mr Fox',
            author_name: ['Roald Dahl'],
            first_publish_year: 1970,
            cover_i: 8231856,
          },
        ],
      }),
    ).toEqual([
      {
        source: 'openlibrary',
        sourceId: 'OL45804W',
        title: 'Fantastic Mr Fox',
        authors: ['Roald Dahl'],
        year: 1970,
        coverUrl: 'https://covers.openlibrary.org/b/id/8231856-M.jpg',
      },
    ])
  })
})

describe('mapOpenLibraryWork', () => {
  const carried = {
    sourceId: 'OL45804W',
    title: 'Fantastic Mr Fox',
    authors: ['Roald Dahl'],
    year: 1970,
    coverUrl: 'https://covers.openlibrary.org/b/id/8231856-M.jpg',
    isbn: '9780140328721',
  }

  it('reads a string description and merges carried fields', () => {
    expect(
      mapOpenLibraryWork(
        { description: 'A clever fox.', subjects: ['Foxes', 'Humor'] },
        carried,
      ),
    ).toEqual({
      title: 'Fantastic Mr Fox',
      authors: ['Roald Dahl'],
      year: 1970,
      cover_url: 'https://covers.openlibrary.org/b/id/8231856-M.jpg',
      description: 'A clever fox.',
      genres: ['Foxes', 'Humor'],
      page_count: null,
      language: null,
      isbn: '9780140328721',
      google_books_id: null,
      open_library_id: 'OL45804W',
    })
  })

  it('reads a {value} description object', () => {
    const m = mapOpenLibraryWork({ description: { value: 'Object form.' } }, carried)
    expect(m.description).toBe('Object form.')
    expect(m.genres).toBeNull()
  })
})

describe('rankSearchResults', () => {
  it('puts starts-with above contains above non-matches (the "101 essays" case)', () => {
    const results = [
      hit({ title: '101 Essays for IAS/PCS', year: 2018 }),
      hit({ title: 'Indian Roots, Ivy Admits: 101 Essays that…', year: 2020 }),
      hit({ title: '成長し続ける人だけが知っている101の人生戦略', year: 2022 }),
    ]
    expect(rankSearchResults(results, '101 essays').map((r) => r.title)).toEqual([
      '101 Essays for IAS/PCS',
      'Indian Roots, Ivy Admits: 101 Essays that…',
      '成長し続ける人だけが知っている101の人生戦略',
    ])
  })

  it('within a tier, sorts by year descending with undated last', () => {
    const results = [
      hit({ title: 'Dune', year: 1965 }),
      hit({ title: 'Dune Messiah', year: null }),
      hit({ title: 'Dune: The Graphic Novel', year: 2020 }),
    ]
    // all start with "dune" → same tier → year desc, null last
    expect(rankSearchResults(results, 'Dune').map((r) => r.year)).toEqual([
      2020,
      1965,
      null,
    ])
  })

  it('returns the input unchanged for an empty query', () => {
    const results = [hit({ title: 'B' }), hit({ title: 'A' })]
    expect(rankSearchResults(results, '  ').map((r) => r.title)).toEqual(['B', 'A'])
  })
})
