import { describe, expect, it } from 'vitest'
import {
  authorMatches,
  capGenres,
  httpsCover,
  isConfidentMatch,
  isDailyQuotaBody,
  mapGoogleSearchItems,
  mapGoogleVolume,
  mapOpenLibrarySearchDocs,
  mapOpenLibraryWork,
  normMatch,
  olCoverUrl,
  pickIsbn,
  pickPublishYear,
  rankSearchResults,
  splitAuthorInput,
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

describe('normMatch', () => {
  it('folds Traditional→Simplified so variants compare equal', () => {
    expect(normMatch('紅樓夢')).toBe(normMatch('红楼梦'))
  })
  it('strips ASCII case + punctuation and all whitespace', () => {
    expect(normMatch('The Hobbit!')).toBe('thehobbit')
    expect(normMatch('A Wrinkle in Time')).toBe('awrinkleintime')
  })
  it('strips CJK punctuation but keeps the ideographs', () => {
    expect(normMatch('《文化苦旅》')).toBe('文化苦旅')
    expect(normMatch('满天星斗：苏秉琦论远古中国')).toBe('满天星斗苏秉琦论远古中国')
  })
  it('never collapses a pure-CJK title to empty (the importer bug)', () => {
    expect(normMatch('红楼梦')).toBe('红楼梦')
  })
})

describe('splitAuthorInput', () => {
  it('splits on comma, 、, slash and ampersand and normalizes', () => {
    expect(splitAuthorInput('张三, 李四')).toEqual(['张三', '李四'])
    expect(splitAuthorInput('张三、李四')).toEqual(['张三', '李四'])
    expect(splitAuthorInput('Foo / Bar & Baz')).toEqual(['foo', 'bar', 'baz'])
  })
  it('is empty for blank/null input', () => {
    expect(splitAuthorInput('')).toEqual([])
    expect(splitAuthorInput(null)).toEqual([])
  })
})

describe('authorMatches', () => {
  it('matches on containment for romanized names', () => {
    expect(authorMatches(['J.R.R. Tolkien'], splitAuthorInput('Tolkien'))).toBe(true)
  })
  it('folds Traditional→Simplified author variants', () => {
    expect(authorMatches(['張宏傑'], splitAuthorInput('张宏杰'))).toBe(true)
  })
  it('is false for a different author and for empty targets', () => {
    expect(authorMatches(['张敞'], splitAuthorInput('张宏杰'))).toBe(false)
    expect(authorMatches(['Anyone'], [])).toBe(false)
    expect(authorMatches(null, splitAuthorInput('张宏杰'))).toBe(false)
  })
  it('ignores sub-2-char tokens to avoid spurious containment', () => {
    expect(authorMatches(['Everyone'], splitAuthorInput('E'))).toBe(false)
  })
})

describe('rankSearchResults', () => {
  it('puts starts-with above contains above non-matches (the "101 essays" case)', () => {
    const results = [
      hit({ title: '101 Essays for IAS/PCS', year: 2018 }),
      hit({ title: 'Indian Roots, Ivy Admits: 101 Essays that…', year: 2020 }),
      hit({ title: '成長し続ける人だけが知っている101の人生戦略', year: 2022 }),
    ]
    expect(
      rankSearchResults(results, { title: '101 essays' }).map((r) => r.title),
    ).toEqual([
      '101 Essays for IAS/PCS',
      'Indian Roots, Ivy Admits: 101 Essays that…',
      '成長し続ける人だけが知っている101の人生戦略',
    ])
  })

  it('within a tier, sorts by year descending with undated last', () => {
    const results = [
      hit({ title: 'Dune Saga', year: 1965 }),
      hit({ title: 'Dune Messiah', year: null }),
      hit({ title: 'Dune: The Graphic Novel', year: 2020 }),
    ]
    // all start with "dune" (none exact) → same tier → year desc, null last
    expect(rankSearchResults(results, { title: 'Dune' }).map((r) => r.year)).toEqual([
      2020,
      1965,
      null,
    ])
  })

  it('ranks an exact title above a contains (文化苦旅 vs 新文化苦旅)', () => {
    const results = [
      hit({ sourceId: 'a', title: '新文化苦旅', year: 2008 }),
      hit({ sourceId: 'b', title: '文化苦旅', year: 1992 }),
    ]
    expect(rankSearchResults(results, { title: '文化苦旅' }).map((r) => r.title)).toEqual(
      ['文化苦旅', '新文化苦旅'],
    )
  })

  it('breaks a same-title tie by author (the 张宏杰 case)', () => {
    const results = [
      hit({ sourceId: 'wrong', title: '千年悖论', authors: ['张敞'] }),
      hit({ sourceId: 'right', title: '千年悖论', authors: ['张宏杰'] }),
    ]
    expect(
      rankSearchResults(results, { title: '千年悖论', author: '张宏杰' }).map(
        (r) => r.sourceId,
      ),
    ).toEqual(['right', 'wrong'])
  })

  it('prefers a prefix-title author match over an exact-title wrong author (坐天下)', () => {
    const results = [
      hit({ sourceId: 'wrong', title: '坐天下', authors: ['张敞'] }),
      hit({
        sourceId: 'right',
        title: '坐天下：张宏杰解读中国帝王',
        authors: ['张宏杰'],
      }),
    ]
    expect(
      rankSearchResults(results, { title: '坐天下', author: '张宏杰' }).map(
        (r) => r.sourceId,
      ),
    ).toEqual(['right', 'wrong'])
  })

  it('does not float a no-title-overlap author match above a wrong-author title match', () => {
    const results = [
      hit({ sourceId: 'title', title: '坐天下', authors: ['张敞'] }),
      hit({ sourceId: 'unrelated', title: '另一本书', authors: ['张宏杰'] }),
    ]
    expect(
      rankSearchResults(results, { title: '坐天下', author: '张宏杰' }).map(
        (r) => r.sourceId,
      ),
    ).toEqual(['title', 'unrelated'])
  })

  it('returns the input unchanged for an empty title + no author', () => {
    const results = [hit({ title: 'B' }), hit({ title: 'A' })]
    expect(rankSearchResults(results, { title: '  ' }).map((r) => r.title)).toEqual([
      'B',
      'A',
    ])
  })
})

describe('isConfidentMatch', () => {
  const target = { title: '坐天下', author: '张宏杰' }
  it('is confident on an exact title + matching author', () => {
    expect(isConfidentMatch({ title: '坐天下', authors: ['张宏杰'] }, target)).toBe(true)
  })
  it('is confident on a subtitle (prefix) title + matching author', () => {
    expect(
      isConfidentMatch(
        { title: '坐天下：张宏杰解读中国帝王', authors: ['张宏杰'] },
        target,
      ),
    ).toBe(true)
  })
  it('flags a same-title wrong-author row for review', () => {
    expect(isConfidentMatch({ title: '坐天下', authors: ['张敞'] }, target)).toBe(false)
  })
  it('flags a contains-only title for review', () => {
    expect(
      isConfidentMatch({ title: '坐天下论', authors: ['张宏杰'] }, { title: '天下' }),
    ).toBe(false)
  })
  it('is confident on title alone when the CSV has no author', () => {
    expect(
      isConfidentMatch({ title: '坐天下', authors: null }, { title: '坐天下' }),
    ).toBe(true)
  })
  it('matches any author of a multi-author CSV row', () => {
    expect(
      isConfidentMatch(
        { title: '某书', authors: ['李四'] },
        { title: '某书', author: '张三, 李四' },
      ),
    ).toBe(true)
  })
})

describe('isDailyQuotaBody', () => {
  it('detects the per-day quota message', () => {
    expect(
      isDailyQuotaBody({
        error: {
          message:
            "Quota exceeded for quota metric 'Queries' and limit 'Queries per day' of service 'books.googleapis.com'.",
        },
      }),
    ).toBe(true)
  })
  it('treats a per-minute/burst 429 as transient (not daily)', () => {
    expect(
      isDailyQuotaBody({
        error: { message: "Quota exceeded ... limit 'Queries per minute'." },
      }),
    ).toBe(false)
  })
  it('returns false for an unrecognised or empty body', () => {
    expect(isDailyQuotaBody(null)).toBe(false)
    expect(isDailyQuotaBody({})).toBe(false)
    expect(isDailyQuotaBody({ error: {} })).toBe(false)
  })
})
