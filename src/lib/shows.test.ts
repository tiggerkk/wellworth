import { describe, expect, it } from 'vitest'
import {
  applyLibraryView,
  buildRefreshPatch,
  countWatchedThisYear,
  DEFAULT_LIBRARY_CRITERIA,
  favoriteShows,
  isAbsoluteUrl,
  isFieldVisible,
  isUpNext,
  markWatched,
  posterUrl,
  progressLabel,
  recentlyWatched,
  showGenres,
  startWatching,
  usesEpisodes,
  type LibraryCriteria,
  type ShowRow,
} from './shows'
import type { ShowMetadata } from './tmdb-api'

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
    original_language: null,
    total_seasons: null,
    total_episodes: null,
    watched_seasons: null,
    watched_episodes: null,
    rating: null,
    lgbtq_rep: 'none',
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

const crit = (p: Partial<LibraryCriteria>): LibraryCriteria => ({
  ...DEFAULT_LIBRARY_CRITERIA,
  ...p,
})

describe('posterUrl', () => {
  it('builds a CDN url for a size + TMDB path', () => {
    expect(posterUrl('/abc.jpg', 'w92')).toBe('https://image.tmdb.org/t/p/w92/abc.jpg')
  })
  it('returns an absolute pasted URL as-is (size ignored)', () => {
    const url = 'https://img.example.com/poster.jpg'
    expect(posterUrl(url, 'w92')).toBe(url)
    expect(posterUrl('http://x.test/p.png', 'w342')).toBe('http://x.test/p.png')
  })
  it('returns null when there is no poster', () => {
    expect(posterUrl(null, 'w92')).toBeNull()
    expect(posterUrl(undefined, 'w342')).toBeNull()
  })
})

describe('isAbsoluteUrl', () => {
  it('detects http(s) URLs but not TMDB paths or blanks', () => {
    expect(isAbsoluteUrl('https://x.test/p.jpg')).toBe(true)
    expect(isAbsoluteUrl('http://x.test/p.jpg')).toBe(true)
    expect(isAbsoluteUrl('/abc.jpg')).toBe(false)
    expect(isAbsoluteUrl(null)).toBe(false)
    expect(isAbsoluteUrl('')).toBe(false)
  })
})

describe('usesEpisodes', () => {
  it('is true for tv and documentary, false for movie', () => {
    expect(usesEpisodes('tv')).toBe(true)
    expect(usesEpisodes('documentary')).toBe(true)
    expect(usesEpisodes('movie')).toBe(false)
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
  it('snaps watched counts to totals for a documentary (episodic)', () => {
    expect(
      markWatched(
        { type: 'documentary', total_seasons: 1, total_episodes: 12 },
        '2026-06-17',
      ),
    ).toEqual({
      status: 'watched',
      end_date: '2026-06-17',
      watched_seasons: 1,
      watched_episodes: 12,
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

describe('favoriteShows', () => {
  it('returns only starred titles, preserving order', () => {
    const a = makeShow({ title: 'A', is_favorite: true })
    const b = makeShow({ title: 'B', is_favorite: false })
    const c = makeShow({ title: 'C', is_favorite: true })
    expect(favoriteShows([a, b, c]).map((s) => s.title)).toEqual(['A', 'C'])
  })
})

describe('buildRefreshPatch', () => {
  const meta: ShowMetadata = {
    title: 'New Title',
    original_title: '新标题',
    year: 2020,
    poster_path: '/new.jpg',
    overview: 'fresh overview',
    genres: ['Documentary'],
    director: 'Dir',
    cast: ['A', 'B'],
    runtime_min: 45,
    original_language: 'zh',
    total_seasons: 2,
    total_episodes: 20,
    tmdb_id: 99,
    imdb_id: 'tt999',
  }
  const current = {
    title: 'Old',
    original_title: null,
    overview: 'old',
    genres: ['Old'],
    director: 'OldDir',
    cast: ['X'],
    total_seasons: 1,
    total_episodes: 10,
    runtime_min: 30,
    original_language: 'en',
    poster_path: '/old.jpg',
  }

  it('patches only TMDB fields — never year or imdb_id', () => {
    const { patch, changed } = buildRefreshPatch(current, meta)
    expect(changed).toBe(true)
    expect(patch.title).toBe('New Title')
    expect(patch.original_title).toBe('新标题')
    expect(patch.poster_path).toBe('/new.jpg') // current was a TMDB path → adopt TMDB poster
    expect(patch).not.toHaveProperty('year')
    expect(patch).not.toHaveProperty('imdb_id')
    expect(patch).not.toHaveProperty('status')
  })

  it('preserves a manually pasted (absolute URL) poster', () => {
    const { patch } = buildRefreshPatch(
      { ...current, poster_path: 'https://manual.test/p.jpg' },
      meta,
    )
    expect(patch.poster_path).toBeUndefined()
  })

  it('reports no change when everything already matches', () => {
    const same = {
      title: meta.title,
      original_title: meta.original_title,
      overview: meta.overview,
      genres: meta.genres,
      director: meta.director,
      cast: meta.cast,
      total_seasons: meta.total_seasons,
      total_episodes: meta.total_episodes,
      runtime_min: meta.runtime_min,
      original_language: meta.original_language,
      poster_path: meta.poster_path,
    }
    expect(buildRefreshPatch(same, meta).changed).toBe(false)
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
  it('filters by documentary type', () => {
    const doc1 = makeShow({ title: '从东晋到北魏', type: 'documentary' })
    const doc2 = makeShow({ title: '消失的楼兰', type: 'documentary' })
    const set = [doc1, doc2, matrix]
    expect(applyLibraryView(set, crit({ type: 'documentary' }))).toHaveLength(2)
  })
  it('filters by favourites only', () => {
    const fav = makeShow({ title: 'Fav', is_favorite: true })
    expect(applyLibraryView([...all, fav], crit({ favoritesOnly: true }))).toEqual([fav])
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
