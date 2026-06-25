import { describe, expect, it } from 'vitest'
import {
  applyLibraryView,
  bookAuthors,
  bookGenres,
  BOOK_ENTRY_FIELDS,
  BOOK_STATUS_CHIP,
  BOOK_STATUS_LABELS,
  BOOK_STATUSES,
  bookSearchText,
  countReadThisYear,
  currentlyReading,
  DEFAULT_LIBRARY_CRITERIA,
  favoriteBooks,
  isFieldVisible,
  LGBTQ_REP_LABELS,
  LGBTQ_REPS,
  markRead,
  recentlyRead,
  startReading,
  wantToRead,
  type BookRow,
  type LibraryCriteria,
} from './books'

const crit = (p: Partial<LibraryCriteria>): LibraryCriteria => ({
  ...DEFAULT_LIBRARY_CRITERIA,
  ...p,
})

function makeBook(p: Partial<BookRow>): BookRow {
  return {
    id: p.title ?? 'x',
    user_id: 'u',
    status: 'want',
    google_books_id: null,
    open_library_id: null,
    isbn: null,
    title: 'Untitled',
    authors: null,
    year: null,
    cover_url: null,
    description: null,
    genres: null,
    page_count: null,
    language: null,
    rating: null,
    lgbtq_rep: 'none',
    dynasty: null,
    is_favorite: false,
    start_date: null,
    end_date: null,
    last_update_date: null,
    comments: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...p,
  }
}

describe('status transitions', () => {
  it('startReading sets reading + start date to today', () => {
    expect(startReading('2026-06-20')).toEqual({
      status: 'reading',
      start_date: '2026-06-20',
    })
  })

  it('markRead sets read + finish date to today', () => {
    expect(markRead('2026-06-20')).toEqual({ status: 'read', end_date: '2026-06-20' })
  })
})

describe('label + chip maps', () => {
  it('labels every status', () => {
    for (const s of BOOK_STATUSES) expect(BOOK_STATUS_LABELS[s]).toBeTruthy()
  })

  it('has a chip palette for every status', () => {
    for (const s of BOOK_STATUSES) expect(BOOK_STATUS_CHIP[s]).toBeTruthy()
  })

  it('labels every LGBT+ representation', () => {
    for (const r of LGBTQ_REPS) expect(LGBTQ_REP_LABELS[r]).toBeTruthy()
  })
})

describe('bookSearchText', () => {
  it('combines title + authors, lowercased', () => {
    expect(bookSearchText({ title: 'Dune', authors: ['Frank Herbert'] })).toBe(
      'dune frank herbert',
    )
  })

  it('handles a missing author list', () => {
    expect(bookSearchText({ title: 'Solo', authors: null })).toBe('solo')
  })

  it('joins multiple authors', () => {
    expect(
      bookSearchText({ title: 'Good Omens', authors: ['Pratchett', 'Gaiman'] }),
    ).toBe('good omens pratchett gaiman')
  })
})

describe('dashboard selectors', () => {
  const books = [
    makeBook({ title: 'r1', status: 'reading' }),
    makeBook({ title: 'w1', status: 'want' }),
    makeBook({ title: 'w2', status: 'want' }),
    makeBook({ title: 'read-jan', status: 'read', end_date: '2026-01-10' }),
    makeBook({ title: 'read-jun', status: 'read', end_date: '2026-06-15' }),
    makeBook({ title: 'read-nodate', status: 'read', end_date: null }),
    makeBook({ title: 'read-2025', status: 'read', end_date: '2025-12-31' }),
    makeBook({ title: 'dropped', status: 'dropped' }),
  ]

  it('currentlyReading keeps only reading books', () => {
    expect(currentlyReading(books).map((b) => b.title)).toEqual(['r1'])
  })

  it('wantToRead filters want and caps to the limit', () => {
    expect(wantToRead(books, 1).map((b) => b.title)).toEqual(['w1'])
    expect(wantToRead(books, 5).map((b) => b.title)).toEqual(['w1', 'w2'])
  })

  it('recentlyRead sorts by end_date desc and excludes null end_date', () => {
    expect(recentlyRead(books, 5).map((b) => b.title)).toEqual([
      'read-jun',
      'read-jan',
      'read-2025',
    ])
  })

  it('recentlyRead respects the limit', () => {
    expect(recentlyRead(books, 1).map((b) => b.title)).toEqual(['read-jun'])
  })

  it('countReadThisYear counts read books finished in the year', () => {
    expect(countReadThisYear(books, 2026)).toBe(2)
    expect(countReadThisYear(books, 2025)).toBe(1)
    expect(countReadThisYear(books, 2024)).toBe(0)
  })

  it('favoriteBooks keeps only starred books, preserving order', () => {
    const list = [
      makeBook({ title: 'a', is_favorite: true }),
      makeBook({ title: 'b', is_favorite: false }),
      makeBook({ title: 'c', is_favorite: true }),
    ]
    expect(favoriteBooks(list).map((b) => b.title)).toEqual(['a', 'c'])
  })
})

describe('bookGenres / bookAuthors', () => {
  it('collects sorted unique genres and authors', () => {
    const books = [
      makeBook({ genres: ['Fantasy', 'Adventure'], authors: ['Tolkien'] }),
      makeBook({ genres: ['Fantasy'], authors: ['Le Guin'] }),
      makeBook({ genres: null, authors: null }),
    ]
    expect(bookGenres(books)).toEqual(['Adventure', 'Fantasy'])
    expect(bookAuthors(books)).toEqual(['Le Guin', 'Tolkien'])
  })
})

describe('applyLibraryView', () => {
  const lib = [
    makeBook({
      title: 'Dune',
      authors: ['Frank Herbert'],
      genres: ['Science Fiction'],
      status: 'read',
      rating: 5,
      lgbtq_rep: 'none',
      end_date: '2026-03-01',
    }),
    makeBook({
      title: 'A Wizard of Earthsea',
      authors: ['Ursula K. Le Guin'],
      genres: ['Fantasy'],
      status: 'reading',
      rating: 4,
      lgbtq_rep: 'some',
      start_date: '2026-05-01',
    }),
    makeBook({
      title: 'Babel',
      authors: ['R.F. Kuang'],
      genres: ['Fantasy'],
      status: 'want',
      rating: null,
      lgbtq_rep: 'significant',
    }),
  ]

  it('filters by query over title + authors', () => {
    expect(applyLibraryView(lib, crit({ query: 'le guin' })).map((b) => b.title)).toEqual(
      ['A Wizard of Earthsea'],
    )
  })

  it('filters by status, genre, and lgbtq', () => {
    expect(applyLibraryView(lib, crit({ status: 'read' })).map((b) => b.title)).toEqual([
      'Dune',
    ])
    expect(
      applyLibraryView(lib, crit({ genre: 'Fantasy' }))
        .map((b) => b.title)
        .sort(),
    ).toEqual(['A Wizard of Earthsea', 'Babel'])
    expect(
      applyLibraryView(lib, crit({ lgbtq: 'significant' })).map((b) => b.title),
    ).toEqual(['Babel'])
  })

  it('treats rating as a minimum', () => {
    expect(applyLibraryView(lib, crit({ minRating: 5 })).map((b) => b.title)).toEqual([
      'Dune',
    ])
  })

  it('filters by favourites only', () => {
    const fav = makeBook({ title: 'Starred', is_favorite: true })
    expect(
      applyLibraryView([...lib, fav], crit({ favoritesOnly: true })).map((b) => b.title),
    ).toEqual(['Starred'])
  })

  it('filters by a finish-date range', () => {
    expect(
      applyLibraryView(lib, crit({ endFrom: '2026-01-01', endTo: '2026-12-31' })).map(
        (b) => b.title,
      ),
    ).toEqual(['Dune'])
  })

  it('sorts by title ascending', () => {
    expect(
      applyLibraryView(lib, crit({ sortField: 'title', sortDir: 'asc' })).map(
        (b) => b.title,
      ),
    ).toEqual(['A Wizard of Earthsea', 'Babel', 'Dune'])
  })

  it('sorts by rating descending with nulls last', () => {
    expect(
      applyLibraryView(lib, crit({ sortField: 'rating', sortDir: 'desc' })).map(
        (b) => b.title,
      ),
    ).toEqual(['Dune', 'A Wizard of Earthsea', 'Babel'])
  })

  it('sorts by dynasty chronologically (newest→oldest) with non-Chinese last', () => {
    const tang = makeBook({ title: '長安', dynasty: '唐代' })
    const qing = makeBook({ title: '紅樓夢', dynasty: '清代' })
    const dune = makeBook({ title: 'Dune' })
    expect(
      applyLibraryView(
        [dune, tang, qing],
        crit({ sortField: 'dynasty', sortDir: 'asc' }),
      ).map((b) => b.title),
    ).toEqual(['紅樓夢', '長安', 'Dune'])
  })
})

describe('isFieldVisible', () => {
  it('treats NULL prefs as all-visible (default-on)', () => {
    for (const f of BOOK_ENTRY_FIELDS) expect(isFieldVisible(null, f.key)).toBe(true)
  })

  it('respects an explicit visible list', () => {
    expect(isFieldVisible(['rating', 'comments'], 'rating')).toBe(true)
    expect(isFieldVisible(['rating', 'comments'], 'year')).toBe(false)
  })
})

describe('BOOK_ENTRY_FIELDS', () => {
  it('lists fields in New/Edit form order with the renamed labels', () => {
    expect(BOOK_ENTRY_FIELDS.map((f) => f.key)).toEqual([
      'authors',
      'year',
      'metadata',
      'rating',
      'lgbtq_rep',
      'dynasty',
      'start_date',
      'end_date',
      'comments',
      'last_update_date',
    ])
    const byKey = Object.fromEntries(BOOK_ENTRY_FIELDS.map((f) => [f.key, f.label]))
    expect(byKey.metadata).toBe('Google Books Metadata')
    expect(byKey.last_update_date).toBe('Last Update Date')
  })
})
