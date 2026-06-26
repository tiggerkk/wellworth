import { describe, expect, it } from 'vitest'
import {
  applyLibraryView,
  DEFAULT_LIBRARY_CRITERIA,
  detectLanguage,
  filterLinkCandidates,
  initialZenPool,
  isFieldVisible,
  nextZenPool,
  QUOTE_ENTRY_FIELDS,
  quoteSearchText,
  rankedTags,
  randomItem,
  type LibraryCriteria,
  type LinkCandidate,
  type QuoteRow,
} from './quotes'

describe('detectLanguage', () => {
  it('returns en for plain English', () => {
    expect(detectLanguage('Time is important. Do not waste a day.')).toBe('en')
  })

  it('returns zh when any CJK character is present', () => {
    expect(detectLanguage('知者不惑')).toBe('zh')
  })

  it('treats mixed text containing CJK as zh', () => {
    expect(detectLanguage('The Analects 论语 says…')).toBe('zh')
  })

  it('returns en for empty text', () => {
    expect(detectLanguage('')).toBe('en')
  })

  it('returns en for punctuation/numbers only', () => {
    expect(detectLanguage('3pm — 100% !?')).toBe('en')
  })
})

describe('quoteSearchText', () => {
  it('lowercases and joins text, author, title, and tags', () => {
    expect(
      quoteSearchText({
        text: 'I detest hypotheticals.',
        author: 'Francis Underwood',
        title: 'House of Cards',
        tags: ['clever', 'irony'],
      }),
    ).toBe('i detest hypotheticals. francis underwood house of cards clever irony')
  })

  it('skips null author/title and missing tags', () => {
    expect(
      quoteSearchText({ text: 'Be here now.', author: null, title: null, tags: [] }),
    ).toBe('be here now.')
  })
})

describe('filterLinkCandidates', () => {
  const candidates: LinkCandidate[] = [
    {
      kind: 'show',
      id: 's1',
      title: 'House of Cards',
      year: 2013,
      thumbUrl: null,
      sourceType: 'tv',
      authors: [],
    },
    {
      kind: 'book',
      id: 'b1',
      title: 'Dune',
      year: 1965,
      thumbUrl: null,
      sourceType: 'book',
      authors: ['Frank Herbert'],
    },
  ]

  it('returns all candidates for an empty/whitespace query', () => {
    expect(filterLinkCandidates(candidates, '')).toHaveLength(2)
    expect(filterLinkCandidates(candidates, '   ')).toHaveLength(2)
  })

  it('matches on title, case-insensitively', () => {
    const r = filterLinkCandidates(candidates, 'house')
    expect(r).toHaveLength(1)
    expect(r[0]?.id).toBe('s1')
  })

  it('matches a book on its author', () => {
    const r = filterLinkCandidates(candidates, 'herbert')
    expect(r).toHaveLength(1)
    expect(r[0]?.id).toBe('b1')
  })

  it('returns nothing when nothing matches', () => {
    expect(filterLinkCandidates(candidates, 'zzz')).toHaveLength(0)
  })
})

describe('initialZenPool', () => {
  const quotes = [
    { id: 'a', is_favorite: false },
    { id: 'b', is_favorite: true },
    { id: 'c', is_favorite: false },
  ]

  it('returns only favourites when some exist', () => {
    expect(initialZenPool(quotes).map((q) => q.id)).toEqual(['b'])
  })

  it('falls back to the whole list when none are favourited', () => {
    const none = quotes.map((q) => ({ ...q, is_favorite: false }))
    expect(initialZenPool(none)).toHaveLength(3)
  })

  it('returns an empty pool for no quotes', () => {
    expect(initialZenPool([])).toEqual([])
  })
})

describe('nextZenPool', () => {
  const quotes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('excludes the current quote', () => {
    expect(nextZenPool(quotes, 'b').map((q) => q.id)).toEqual(['a', 'c'])
  })

  it('returns the whole list when only the current quote exists', () => {
    expect(nextZenPool([{ id: 'a' }], 'a').map((q) => q.id)).toEqual(['a'])
  })

  it('returns the whole list when there is no current quote', () => {
    expect(nextZenPool(quotes, null)).toHaveLength(3)
  })
})

describe('randomItem', () => {
  it('picks by the injected random fraction', () => {
    const items = ['x', 'y', 'z']
    expect(randomItem(items, () => 0)).toBe('x')
    expect(randomItem(items, () => 0.99)).toBe('z')
  })

  it('returns null for an empty list', () => {
    expect(randomItem([], () => 0)).toBeNull()
  })
})

describe('rankedTags', () => {
  it('counts distinct tags, sorted by count desc then alpha', () => {
    expect(
      rankedTags([{ tags: ['wit', 'irony'] }, { tags: ['irony', 'clever'] }]),
    ).toEqual([
      { tag: 'irony', count: 2 },
      { tag: 'clever', count: 1 },
      { tag: 'wit', count: 1 },
    ])
  })

  it('ignores missing tags', () => {
    expect(rankedTags([{ tags: [] }, { tags: ['zen'] }])).toEqual([
      { tag: 'zen', count: 1 },
    ])
  })
})

describe('applyLibraryView', () => {
  function makeQuote(over: Partial<QuoteRow> & { id: string }): QuoteRow {
    return {
      user_id: 'u',
      text: 'some text',
      author: null,
      source_type: 'tv',
      title: null,
      category: 'wit',
      tags: [],
      language: 'en',
      is_favorite: false,
      show_id: null,
      book_id: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      text_norm: null,
      ...over,
    }
  }

  const quotes: QuoteRow[] = [
    makeQuote({
      id: 'a',
      text: 'I detest hypotheticals.',
      author: 'Francis Underwood',
      category: 'wit',
      tags: ['clever', 'irony'],
      source_type: 'tv',
      is_favorite: true,
      show_id: 'show-1',
    }),
    makeQuote({
      id: 'b',
      text: '知者不惑',
      category: 'philosophy',
      tags: ['zen'],
      source_type: 'book',
      language: 'zh',
      book_id: 'book-1',
    }),
    makeQuote({
      id: 'c',
      text: 'Be here now.',
      category: 'philosophy',
      tags: ['zen', 'mindfulness'],
      source_type: 'song',
    }),
  ]

  const crit = (over: Partial<LibraryCriteria>): LibraryCriteria => ({
    ...DEFAULT_LIBRARY_CRITERIA,
    ...over,
  })

  it('returns everything for the default criteria', () => {
    expect(applyLibraryView(quotes, DEFAULT_LIBRARY_CRITERIA)).toHaveLength(3)
  })

  it('matches the query across text / author / tags', () => {
    expect(
      applyLibraryView(quotes, crit({ query: 'underwood' })).map((q) => q.id),
    ).toEqual(['a'])
    expect(
      applyLibraryView(quotes, crit({ query: 'mindfulness' })).map((q) => q.id),
    ).toEqual(['c'])
  })

  it('filters by category', () => {
    expect(
      applyLibraryView(quotes, crit({ category: 'philosophy' })).map((q) => q.id),
    ).toEqual(['b', 'c'])
  })

  it('treats multi-select tags as OR (any)', () => {
    expect(
      applyLibraryView(quotes, crit({ tags: ['clever', 'mindfulness'] })).map(
        (q) => q.id,
      ),
    ).toEqual(['a', 'c'])
  })

  it('filters favourites, source type, and language', () => {
    expect(
      applyLibraryView(quotes, crit({ favoritesOnly: true })).map((q) => q.id),
    ).toEqual(['a'])
    expect(
      applyLibraryView(quotes, crit({ sourceType: 'song' })).map((q) => q.id),
    ).toEqual(['c'])
    expect(applyLibraryView(quotes, crit({ language: 'zh' })).map((q) => q.id)).toEqual([
      'b',
    ])
  })

  it('constrains to a linked show or book', () => {
    expect(applyLibraryView(quotes, crit({ showId: 'show-1' })).map((q) => q.id)).toEqual(
      ['a'],
    )
    expect(applyLibraryView(quotes, crit({ bookId: 'book-1' })).map((q) => q.id)).toEqual(
      ['b'],
    )
  })

  it('filters to linked titles only', () => {
    // 'a' is linked to a show, 'b' to a book, 'c' to neither.
    expect(applyLibraryView(quotes, crit({ linkedOnly: true })).map((q) => q.id)).toEqual(
      ['a', 'b'],
    )
  })

  it('combines facets and preserves input order', () => {
    const r = applyLibraryView(quotes, crit({ category: 'philosophy', tags: ['zen'] }))
    expect(r.map((q) => q.id)).toEqual(['b', 'c'])
  })

  it('sorts by date (created_at) — newest first by default, oldest first on toggle', () => {
    const dated = [
      makeQuote({ id: 'old', created_at: '2026-01-01T00:00:00Z' }),
      makeQuote({ id: 'new', created_at: '2026-03-01T00:00:00Z' }),
      makeQuote({ id: 'mid', created_at: '2026-02-01T00:00:00Z' }),
    ]
    expect(applyLibraryView(dated, crit({})).map((q) => q.id)).toEqual([
      'new',
      'mid',
      'old',
    ])
    expect(applyLibraryView(dated, crit({ sortDir: 'asc' })).map((q) => q.id)).toEqual([
      'old',
      'mid',
      'new',
    ])
  })

  it('sorts by source type (on the stored key) ascending', () => {
    expect(
      applyLibraryView(quotes, crit({ sortField: 'sourceType', sortDir: 'asc' })).map(
        (q) => q.id,
      ),
    ).toEqual(['b', 'c', 'a'])
  })
})

describe('isFieldVisible', () => {
  it('treats NULL prefs as all-visible (default-on)', () => {
    expect(isFieldVisible(null, 'author')).toBe(true)
  })

  it('respects an explicit visible list', () => {
    expect(isFieldVisible(['author', 'tags'], 'author')).toBe(true)
    expect(isFieldVisible(['author', 'tags'], 'language')).toBe(false)
  })
})

describe('QUOTE_ENTRY_FIELDS', () => {
  it('lists fields in New/Edit form order', () => {
    expect(QUOTE_ENTRY_FIELDS.map((f) => f.key)).toEqual([
      'title',
      'source_link',
      'author',
      'source_type',
      'language',
      'tags',
    ])
  })
})
