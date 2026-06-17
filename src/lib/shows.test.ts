import { describe, expect, it } from 'vitest'
import {
  applyLibraryView,
  countWatchedThisYear,
  DEFAULT_LIBRARY_CRITERIA,
  isFieldVisible,
  isUpNext,
  markWatched,
  posterUrl,
  progressLabel,
  recentlyWatched,
  showGenres,
  startWatching,
  type LibraryCriteria,
  type ShowRow,
} from './shows'

function makeShow(p: Partial<ShowRow>): ShowRow {
  return {
    id: p.title ?? 'x',
    user_id: 'u',
    type: 'movie',
    status: 'want',
    tmdb_id: null,
    imdb_id: null,
    title: 'Untitled',
    original_title: null,
    year: null,
    poster_path: null,
    overview: null,
    genres: null,
    director: null,
    cast: null,
    runtime_min: null,
    content_rating: null,
    original_language: null,
    total_seasons: null,
    total_episodes: null,
    watched_seasons: null,
    watched_episodes: null,
    rating: null,
    lgbtq_rep: 'none',
    start_date: null,
    end_date: null,
    last_update_date: null,
    comments: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...p,
  }
}

const crit = (p: Partial<LibraryCriteria>): LibraryCriteria => ({
  ...DEFAULT_LIBRARY_CRITERIA,
  ...p,
})

describe('posterUrl', () => {
  it('builds a CDN url for a size + path', () => {
    expect(posterUrl('/abc.jpg', 'w92')).toBe('https://image.tmdb.org/t/p/w92/abc.jpg')
  })
  it('returns null when there is no poster', () => {
    expect(posterUrl(null, 'w92')).toBeNull()
    expect(posterUrl(undefined, 'w342')).toBeNull()
  })
})

describe('startWatching', () => {
  it('sets status watching + start date to today', () => {
    expect(startWatching('2026-06-17')).toEqual({
      status: 'watching',
      start_date: '2026-06-17',
    })
  })
})

describe('markWatched', () => {
  it('sets watched + finish date + TV counts to the totals', () => {
    expect(
      markWatched({ type: 'tv', total_seasons: 3, total_episodes: 30 }, '2026-06-17'),
    ).toEqual({
      status: 'watched',
      end_date: '2026-06-17',
      watched_seasons: 3,
      watched_episodes: 30,
    })
  })
  it('leaves counts null for a movie', () => {
    expect(
      markWatched(
        { type: 'movie', total_seasons: null, total_episodes: null },
        '2026-06-17',
      ),
    ).toEqual({
      status: 'watched',
      end_date: '2026-06-17',
      watched_seasons: null,
      watched_episodes: null,
    })
  })
})

describe('progressLabel', () => {
  it('formats season + episode progress', () => {
    expect(
      progressLabel({ watched_seasons: 2, watched_episodes: 18, total_episodes: 30 }),
    ).toBe('S2 · 18/30')
  })
  it('treats nulls as zero', () => {
    expect(
      progressLabel({
        watched_seasons: null,
        watched_episodes: null,
        total_episodes: null,
      }),
    ).toBe('S0 · 0/0')
  })
})

describe('isUpNext', () => {
  it('is true for an in-progress TV show with episodes remaining', () => {
    expect(
      isUpNext({
        status: 'watching',
        type: 'tv',
        watched_episodes: 5,
        total_episodes: 10,
      }),
    ).toBe(true)
  })
  it('is false once all episodes are watched', () => {
    expect(
      isUpNext({
        status: 'watching',
        type: 'tv',
        watched_episodes: 10,
        total_episodes: 10,
      }),
    ).toBe(false)
  })
  it('is false for movies and non-watching statuses', () => {
    expect(
      isUpNext({
        status: 'watching',
        type: 'movie',
        watched_episodes: 0,
        total_episodes: 0,
      }),
    ).toBe(false)
    expect(
      isUpNext({ status: 'want', type: 'tv', watched_episodes: 0, total_episodes: 10 }),
    ).toBe(false)
  })
})

describe('recentlyWatched', () => {
  const shows = [
    { status: 'watched', end_date: '2026-06-01' },
    { status: 'watched', end_date: '2026-06-10' },
    { status: 'watched', end_date: null }, // imported, unknown date → excluded
    { status: 'watching', end_date: '2026-06-15' }, // not watched → excluded
    { status: 'watched', end_date: '2026-05-20' },
  ]
  it('returns watched titles with a date, newest first, capped to the limit', () => {
    expect(recentlyWatched(shows, 2).map((s) => s.end_date)).toEqual([
      '2026-06-10',
      '2026-06-01',
    ])
  })
  it('excludes null-date and non-watched rows', () => {
    expect(recentlyWatched(shows, 10)).toHaveLength(3)
  })
})

describe('countWatchedThisYear', () => {
  const shows = [
    { status: 'watched', end_date: '2026-01-02' },
    { status: 'watched', end_date: '2026-12-31' },
    { status: 'watched', end_date: '2025-06-01' }, // different year
    { status: 'watched', end_date: null }, // no date
    { status: 'watching', end_date: '2026-03-03' }, // not watched
  ]
  it('counts watched titles finished in the year', () => {
    expect(countWatchedThisYear(shows, 2026)).toBe(2)
    expect(countWatchedThisYear(shows, 2025)).toBe(1)
  })
})

describe('showGenres', () => {
  it('returns sorted unique genres present', () => {
    expect(
      showGenres([
        makeShow({ genres: ['Drama', 'Action'] }),
        makeShow({ genres: ['Action', 'Comedy'] }),
        makeShow({ genres: null }),
      ]),
    ).toEqual(['Action', 'Comedy', 'Drama'])
  })
})

describe('applyLibraryView', () => {
  const matrix = makeShow({
    title: 'The Matrix',
    type: 'movie',
    status: 'watched',
    year: 1999,
    rating: 5,
    genres: ['Action', 'Sci-Fi'],
    director: 'Lana Wachowski',
    cast: ['Keanu Reeves'],
    end_date: '2026-03-10',
  })
  const bb = makeShow({
    title: 'Breaking Bad',
    type: 'tv',
    status: 'watching',
    year: 2008,
    rating: 4.5,
    genres: ['Drama'],
    end_date: null,
  })
  const heat = makeShow({
    title: 'Heat',
    type: 'movie',
    status: 'want',
    year: null,
    rating: null,
    genres: ['Crime'],
  })
  const all = [matrix, bb, heat]

  it('matches search against director and cast, not just title', () => {
    expect(applyLibraryView(all, crit({ query: 'keanu' }))).toEqual([matrix])
    expect(applyLibraryView(all, crit({ query: 'wachowski' }))).toEqual([matrix])
  })
  it('filters by type and status', () => {
    expect(applyLibraryView(all, crit({ type: 'tv' }))).toEqual([bb])
    expect(applyLibraryView(all, crit({ status: 'want' }))).toEqual([heat])
  })
  it('filters by genre and minimum rating', () => {
    expect(applyLibraryView(all, crit({ genre: 'Drama' }))).toEqual([bb])
    expect(applyLibraryView(all, crit({ minRating: 5 }))).toEqual([matrix])
  })
  it('filters by a finish-date range', () => {
    expect(
      applyLibraryView(all, crit({ endFrom: '2026-01-01', endTo: '2026-06-01' })),
    ).toEqual([matrix])
  })
  it('sorts by year ascending with nulls last', () => {
    expect(
      applyLibraryView(all, crit({ sortField: 'year', sortDir: 'asc' })).map(
        (s) => s.title,
      ),
    ).toEqual(['The Matrix', 'Breaking Bad', 'Heat'])
  })
  it('sorts by title descending', () => {
    expect(
      applyLibraryView(all, crit({ sortField: 'title', sortDir: 'desc' })).map(
        (s) => s.title,
      ),
    ).toEqual(['The Matrix', 'Heat', 'Breaking Bad'])
  })
})

describe('isFieldVisible', () => {
  it('treats null prefs (or an unknown key) as visible — default-on', () => {
    expect(isFieldVisible(null, 'rating')).toBe(true)
    expect(isFieldVisible(['rating'], 'newly_added_field')).toBe(false)
  })
  it('honours an explicit visible list', () => {
    expect(isFieldVisible(['year', 'comments'], 'comments')).toBe(true)
    expect(isFieldVisible(['year', 'comments'], 'rating')).toBe(false)
  })
})
