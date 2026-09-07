import { describe, expect, it } from 'vitest'
import {
  bulkRefreshCandidates,
  hasNewEpisodesAvailable,
  refreshAllFromTmdb,
} from './shows-bulk-refresh'
import type { ShowRow } from './shows'

function makeShow(p: Partial<ShowRow> & { id: string }): ShowRow {
  return {
    user_id: 'u',
    type: 'tv',
    status: 'watching',
    tmdb_id: 1,
    imdb_id: null,
    title: 'Show',
    original_title: null,
    year: null,
    poster_path: null,
    overview: null,
    genres: null,
    director: null,
    cast: null,
    runtime_min: null,
    original_language: null,
    total_seasons: 2,
    total_episodes: 18,
    season_episode_counts: { 1: 10, 2: 8 },
    watched_seasons: 2,
    watched_episodes: 8,
    rating: null,
    lgbtq_rep: 'none',
    dynasty: null,
    is_favorite: false,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...p,
  }
}

describe('bulkRefreshCandidates', () => {
  it('includes Want and Watching episodic titles with a tmdb_id', () => {
    const want = makeShow({ id: 'a', status: 'want' })
    const watching = makeShow({ id: 'b', status: 'watching' })
    expect(bulkRefreshCandidates([want, watching]).map((s) => s.id)).toEqual(['a', 'b'])
  })
  it('excludes movies', () => {
    const movie = makeShow({ id: 'a', type: 'movie' })
    expect(bulkRefreshCandidates([movie])).toEqual([])
  })
  it('excludes Watched and Dropped titles', () => {
    const watched = makeShow({ id: 'a', status: 'watched' })
    const dropped = makeShow({ id: 'b', status: 'dropped' })
    expect(bulkRefreshCandidates([watched, dropped])).toEqual([])
  })
  it('excludes titles with no tmdb_id', () => {
    const noMatch = makeShow({ id: 'a', tmdb_id: null })
    expect(bulkRefreshCandidates([noMatch])).toEqual([])
  })
})

describe('hasNewEpisodesAvailable', () => {
  it('is true when a caught-up show now has a higher total', () => {
    expect(
      hasNewEpisodesAvailable(
        {
          watched_seasons: 2,
          watched_episodes: 8,
          total_episodes: 18,
          season_episode_counts: { 1: 10, 2: 8 },
        },
        26,
      ),
    ).toBe(true)
  })
  it('is false when the total did not increase', () => {
    expect(
      hasNewEpisodesAvailable(
        {
          watched_seasons: 2,
          watched_episodes: 8,
          total_episodes: 18,
          season_episode_counts: { 1: 10, 2: 8 },
        },
        18,
      ),
    ).toBe(false)
  })
  it('is false when the show was not caught up before the refresh', () => {
    expect(
      hasNewEpisodesAvailable(
        {
          watched_seasons: 2,
          watched_episodes: 3,
          total_episodes: 18,
          season_episode_counts: { 1: 10, 2: 8 },
        },
        26,
      ),
    ).toBe(false)
  })
})

describe('refreshAllFromTmdb', () => {
  it('reports an error outcome without throwing when a refresh fails', async () => {
    const show = makeShow({ id: 'a', tmdb_id: null }) // no tmdb_id -> refreshFromTmdb throws
    const updateShow = async () => {}
    const results = await refreshAllFromTmdb([show], updateShow)
    expect(results).toHaveLength(1)
    expect(results[0]!.error).toBeTruthy()
    expect(results[0]!.changed).toBe(false)
  })
})
