import { describe, expect, it } from 'vitest'
import {
  isConfidentTitleMatch,
  mapMovieDetails,
  mapSearchResults,
  mapTvDetails,
  parseTitleYear,
  pickCast,
  pickDirectorFromCrew,
  pickSeasonEpisodeCounts,
  pickYear,
  rankTitleResults,
  type TmdbSearchResult,
} from './shows-tmdb-api'

const hit = (p: Partial<TmdbSearchResult>): TmdbSearchResult => ({
  tmdbId: p.tmdbId ?? Math.abs((p.title ?? 'x').length + (p.year ?? 0)),
  type: 'tv',
  title: 'Untitled',
  year: null,
  posterPath: null,
  ...p,
})

describe('pickYear', () => {
  it('extracts the year from a TMDB date', () => {
    expect(pickYear('1999-03-31')).toBe(1999)
  })
  it('returns null for empty/missing dates', () => {
    expect(pickYear('')).toBeNull()
    expect(pickYear(null)).toBeNull()
    expect(pickYear(undefined)).toBeNull()
  })
})

describe('pickDirectorFromCrew', () => {
  it('joins crew members whose job is Director', () => {
    expect(
      pickDirectorFromCrew([
        { job: 'Director', name: 'Lana Wachowski' },
        { job: 'Director', name: 'Lilly Wachowski' },
        { job: 'Writer', name: 'Someone Else' },
      ]),
    ).toBe('Lana Wachowski, Lilly Wachowski')
  })
  it('returns null when there is no director', () => {
    expect(pickDirectorFromCrew([{ job: 'Writer', name: 'X' }])).toBeNull()
    expect(pickDirectorFromCrew(undefined)).toBeNull()
  })
})

describe('pickCast', () => {
  it('takes the top 10 cast names', () => {
    const cast = Array.from({ length: 14 }, (_, i) => ({ name: `Actor ${i + 1}` }))
    const result = pickCast(cast)
    expect(result).toHaveLength(10)
    expect(result?.[0]).toBe('Actor 1')
    expect(result?.[9]).toBe('Actor 10')
  })
  it('returns null when empty', () => {
    expect(pickCast([])).toBeNull()
    expect(pickCast(undefined)).toBeNull()
  })
})

describe('mapSearchResults', () => {
  it('maps movie hits (title + release_date)', () => {
    expect(
      mapSearchResults('movie', {
        results: [
          {
            id: 603,
            title: 'The Matrix',
            release_date: '1999-03-31',
            poster_path: '/m.jpg',
          },
        ],
      }),
    ).toEqual([
      {
        tmdbId: 603,
        type: 'movie',
        title: 'The Matrix',
        year: 1999,
        posterPath: '/m.jpg',
      },
    ])
  })
  it('maps tv hits (name + first_air_date)', () => {
    expect(
      mapSearchResults('tv', {
        results: [
          {
            id: 1396,
            name: 'Breaking Bad',
            first_air_date: '2008-01-20',
            poster_path: null,
          },
        ],
      }),
    ).toEqual([
      { tmdbId: 1396, type: 'tv', title: 'Breaking Bad', year: 2008, posterPath: null },
    ])
  })
  it('handles missing results', () => {
    expect(mapSearchResults('movie', {})).toEqual([])
  })
})

describe('mapMovieDetails', () => {
  it('maps a movie into our show columns', () => {
    expect(
      mapMovieDetails({
        id: 603,
        title: 'The Matrix',
        original_title: 'The Matrix',
        release_date: '1999-03-31',
        poster_path: '/m.jpg',
        overview: 'A hacker learns the truth.',
        genres: [{ name: 'Action' }, { name: 'Science Fiction' }],
        runtime: 136,
        original_language: 'en',
        imdb_id: 'tt0133093',
        credits: {
          crew: [{ job: 'Director', name: 'Lana Wachowski' }],
          cast: [{ name: 'Keanu Reeves' }, { name: 'Carrie-Anne Moss' }],
        },
      }),
    ).toEqual({
      title: 'The Matrix',
      original_title: 'The Matrix',
      year: 1999,
      poster_path: '/m.jpg',
      overview: 'A hacker learns the truth.',
      genres: ['Action', 'Science Fiction'],
      director: 'Lana Wachowski',
      cast: ['Keanu Reeves', 'Carrie-Anne Moss'],
      runtime_min: 136,
      original_language: 'en',
      total_seasons: null,
      total_episodes: null,
      season_episode_counts: null,
      tmdb_id: 603,
      imdb_id: 'tt0133093',
    })
  })
})

describe('pickSeasonEpisodeCounts', () => {
  it('maps season_number ⇒ episode_count (specials included)', () => {
    expect(
      pickSeasonEpisodeCounts([
        { season_number: 0, episode_count: 3 },
        { season_number: 1, episode_count: 8 },
        { season_number: 2, episode_count: 10 },
      ]),
    ).toEqual({ 0: 3, 1: 8, 2: 10 })
  })
  it('drops seasons missing a count and returns null when nothing is usable', () => {
    expect(pickSeasonEpisodeCounts([{ season_number: 1 }])).toBeNull()
    expect(pickSeasonEpisodeCounts([])).toBeNull()
    expect(pickSeasonEpisodeCounts(undefined)).toBeNull()
  })
})

describe('mapTvDetails', () => {
  it('maps a TV show — creator(s), episode runtime, season/episode totals, imdb from external_ids', () => {
    expect(
      mapTvDetails({
        id: 1396,
        name: 'Breaking Bad',
        original_name: 'Breaking Bad',
        first_air_date: '2008-01-20',
        poster_path: '/bb.jpg',
        overview: 'A chemistry teacher turns to crime.',
        genres: [{ name: 'Drama' }],
        episode_run_time: [45],
        number_of_seasons: 5,
        number_of_episodes: 62,
        seasons: [
          { season_number: 1, episode_count: 7 },
          { season_number: 2, episode_count: 13 },
        ],
        original_language: 'en',
        created_by: [{ name: 'Vince Gilligan' }],
        credits: { cast: [{ name: 'Bryan Cranston' }] },
        external_ids: { imdb_id: 'tt0903747' },
      }),
    ).toEqual({
      title: 'Breaking Bad',
      original_title: 'Breaking Bad',
      year: 2008,
      poster_path: '/bb.jpg',
      overview: 'A chemistry teacher turns to crime.',
      genres: ['Drama'],
      director: 'Vince Gilligan',
      cast: ['Bryan Cranston'],
      runtime_min: 45,
      original_language: 'en',
      total_seasons: 5,
      total_episodes: 62,
      season_episode_counts: { 1: 7, 2: 13 },
      tmdb_id: 1396,
      imdb_id: 'tt0903747',
    })
  })
})

describe('parseTitleYear', () => {
  it('splits a trailing (YYYY) suffix off the title', () => {
    expect(parseTitleYear('Beyond (2017)')).toEqual({ title: 'Beyond', year: 2017 })
    expect(parseTitleYear('One Day at a Time (2017)')).toEqual({
      title: 'One Day at a Time',
      year: 2017,
    })
  })
  it('leaves a title with no suffix untouched (year null)', () => {
    expect(parseTitleYear('The Chair')).toEqual({ title: 'The Chair', year: null })
    expect(parseTitleYear('  Girls  ')).toEqual({ title: 'Girls', year: null })
  })
})

describe('rankTitleResults', () => {
  it('floats an exact title above contains/prefix noise (the "Beyond" case)', () => {
    const results = [
      hit({ tmdbId: 1, title: 'Love Beyond Dreams', year: 2010 }),
      hit({ tmdbId: 2, title: 'Batman Beyond', year: 1999 }),
      hit({ tmdbId: 3, title: 'Beyond', year: 2017 }),
    ]
    expect(
      rankTitleResults(results, { title: 'Beyond', year: 2017 }).map((r) => r.tmdbId),
    ).toEqual([3, 1, 2])
  })

  it('puts an exact title above a prefix one (the "The Chair" case)', () => {
    const results = [
      hit({ tmdbId: 1, title: 'The Chair Company', year: 2025 }),
      hit({ tmdbId: 2, title: 'The Chair', year: 2021 }),
    ]
    expect(
      rankTitleResults(results, { title: 'The Chair', year: 2021 }).map((r) => r.tmdbId),
    ).toEqual([2, 1])
  })

  it('disambiguates same-titled results by the hinted year', () => {
    const results = [
      hit({ tmdbId: 1, title: 'One Day at a Time', year: 1975 }),
      hit({ tmdbId: 2, title: 'One Day at a Time', year: 2017 }),
    ]
    expect(
      rankTitleResults(results, { title: 'One Day at a Time', year: 2017 }).map(
        (r) => r.tmdbId,
      ),
    ).toEqual([2, 1])
  })

  it('with no year hint, prefers the more recent same-titled result', () => {
    const results = [
      hit({ tmdbId: 1, title: 'One Day at a Time', year: 1975 }),
      hit({ tmdbId: 2, title: 'One Day at a Time', year: 2017 }),
    ]
    expect(
      rankTitleResults(results, { title: 'One Day at a Time' }).map((r) => r.tmdbId),
    ).toEqual([2, 1])
  })
})

describe('isConfidentTitleMatch', () => {
  it('is confident on an exact title within a year of the hint', () => {
    expect(
      isConfidentTitleMatch(
        { title: 'Beyond', year: 2017 },
        { title: 'Beyond', year: 2017 },
      ),
    ).toBe(true)
  })
  it('flags an exact title whose year is far from the hint', () => {
    expect(
      isConfidentTitleMatch(
        { title: 'One Day at a Time', year: 1975 },
        { title: 'One Day at a Time', year: 2017 },
      ),
    ).toBe(false)
  })
  it('is confident on title alone when there is no year hint', () => {
    expect(
      isConfidentTitleMatch({ title: 'The Chair', year: 2021 }, { title: 'The Chair' }),
    ).toBe(true)
  })
  it('flags a contains-only title for review', () => {
    expect(
      isConfidentTitleMatch({ title: 'Batman Beyond', year: 1999 }, { title: 'Beyond' }),
    ).toBe(false)
  })
})
