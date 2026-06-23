import { describe, expect, it } from 'vitest'
import {
  mapMovieDetails,
  mapSearchResults,
  mapTvDetails,
  pickCast,
  pickDirectorFromCrew,
  pickSeasonEpisodeCounts,
  pickYear,
} from './tmdb-api'

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
