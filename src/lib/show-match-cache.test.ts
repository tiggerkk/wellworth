import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearShowMatchCache,
  getCachedShowMatch,
  removeCachedShowMatch,
  setCachedShowMatch,
  showMatchCacheSize,
  showMatchKey,
} from './show-match-cache'
import type { ShowMetadata } from './tmdb-api'

const meta = (title: string): ShowMetadata => ({
  title,
  original_title: null,
  year: 2000,
  poster_path: null,
  overview: null,
  genres: null,
  director: null,
  cast: null,
  runtime_min: null,
  original_language: null,
  total_seasons: null,
  total_episodes: null,
  season_episode_counts: null,
  tmdb_id: 1,
  imdb_id: null,
})

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('showMatchKey', () => {
  it('distinguishes type and year but folds title case/space/script', () => {
    expect(showMatchKey('movie', 'The Matrix', 1999)).not.toBe(
      showMatchKey('tv', 'The Matrix', 1999),
    )
    expect(showMatchKey('movie', 'Dune', 1984)).not.toBe(
      showMatchKey('movie', 'Dune', 2021),
    )
    expect(showMatchKey('movie', 'The  Matrix ', 1999)).toBe(
      showMatchKey('movie', 'the matrix', 1999),
    )
  })
  it('treats a missing year distinctly from a present one', () => {
    expect(showMatchKey('tv', 'Beyond', null)).not.toBe(
      showMatchKey('tv', 'Beyond', 2017),
    )
  })
})

describe('show match cache', () => {
  it('stores and retrieves by type+title+year', () => {
    expect(getCachedShowMatch('movie', 'Dune', 2021)).toBeNull()
    setCachedShowMatch('movie', 'Dune', 2021, meta('Dune'))
    expect(getCachedShowMatch('movie', 'dune', 2021)?.title).toBe('Dune')
    expect(getCachedShowMatch('tv', 'Dune', 2021)).toBeNull() // wrong type → miss
    expect(showMatchCacheSize()).toBe(1)
  })
  it('removes a single entry and clears all', () => {
    setCachedShowMatch('movie', 'Dune', 2021, meta('Dune'))
    setCachedShowMatch('tv', 'Severance', 2022, meta('Severance'))
    removeCachedShowMatch('movie', 'Dune', 2021)
    expect(getCachedShowMatch('movie', 'Dune', 2021)).toBeNull()
    expect(showMatchCacheSize()).toBe(1)
    clearShowMatchCache()
    expect(showMatchCacheSize()).toBe(0)
  })
})
