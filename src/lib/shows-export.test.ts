import { describe, expect, it } from 'vitest'
import { buildShowsExportRows } from './shows-export'
import type { ShowRow } from './shows'

function makeShow(overrides: Partial<ShowRow> = {}): ShowRow {
  return {
    id: 's1',
    user_id: 'u1',
    type: 'tv',
    status: 'watched',
    title: 'Show Title',
    original_title: null,
    year: null,
    poster_path: null,
    genres: null,
    director: null,
    cast: null,
    runtime_min: null,
    total_seasons: null,
    total_episodes: null,
    watched_seasons: null,
    watched_episodes: null,
    rating: null,
    lgbtq_rep: 'none',
    dynasty: null,
    is_favorite: false,
    start_date: '2026-01-01',
    end_date: '2026-01-10',
    notes: null,
    imdb_id: null,
    tmdb_id: null,
    original_language: null,
    overview: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    ...overrides,
  }
}

describe('buildShowsExportRows', () => {
  it('emits the header row matching the importer column spec', () => {
    expect(buildShowsExportRows([])).toEqual([
      [
        'title',
        'type',
        'status',
        'rating',
        'lgbtq_rep',
        'dynasty',
        'watched_seasons',
        'watched_episodes',
        'is_favorite',
        'start_date',
        'end_date',
        'notes',
      ],
    ])
  })

  it('emits one row per show with all columns', () => {
    const rows = buildShowsExportRows([
      makeShow({
        title: 'Breaking Bad',
        type: 'tv',
        status: 'watched',
        rating: 4.5,
        lgbtq_rep: 'some',
        dynasty: null,
        watched_seasons: 5,
        watched_episodes: 62,
        is_favorite: true,
        start_date: '2025-01-01',
        end_date: '2025-06-01',
        notes: 'Great show',
      }),
    ])
    expect(rows[1]).toEqual([
      'Breaking Bad',
      'tv',
      'watched',
      '4.5',
      'some',
      '',
      '5',
      '62',
      'true',
      '2025-01-01',
      '2025-06-01',
      'Great show',
    ])
  })

  it('exports null rating/watched_seasons/watched_episodes as empty strings', () => {
    const rows = buildShowsExportRows([
      makeShow({ rating: null, watched_seasons: null, watched_episodes: null }),
    ])
    expect(rows[1]?.[3]).toBe('')
    expect(rows[1]?.[6]).toBe('')
    expect(rows[1]?.[7]).toBe('')
  })

  it('exports null dynasty/notes/dates as empty strings, is_favorite false as empty', () => {
    const rows = buildShowsExportRows([
      makeShow({
        dynasty: null,
        notes: null,
        start_date: null,
        end_date: null,
        is_favorite: false,
      }),
    ])
    expect(rows[1]?.[5]).toBe('')
    expect(rows[1]?.[8]).toBe('')
    expect(rows[1]?.[9]).toBe('')
    expect(rows[1]?.[10]).toBe('')
    expect(rows[1]?.[11]).toBe('')
  })

  it('sorts by type in canonical enum order (tv, movie, documentary), not alphabetically', () => {
    const rows = buildShowsExportRows([
      makeShow({ title: 'A Movie', type: 'movie' }),
      makeShow({ title: 'A Doc', type: 'documentary' }),
      makeShow({ title: 'A Show', type: 'tv' }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual(['A Show', 'A Movie', 'A Doc'])
  })

  it('breaks a type tie by status in canonical enum order (want, watching, watched, dropped)', () => {
    const rows = buildShowsExportRows([
      makeShow({ title: 'Dropped one', type: 'tv', status: 'dropped' }),
      makeShow({ title: 'Want one', type: 'tv', status: 'want' }),
      makeShow({ title: 'Watching one', type: 'tv', status: 'watching' }),
      makeShow({ title: 'Watched one', type: 'tv', status: 'watched' }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual([
      'Want one',
      'Watching one',
      'Watched one',
      'Dropped one',
    ])
  })

  it('breaks a type + status tie by start_date ascending', () => {
    const rows = buildShowsExportRows([
      makeShow({
        title: 'Later',
        type: 'tv',
        status: 'watched',
        start_date: '2026-03-01',
      }),
      makeShow({
        title: 'Earlier',
        type: 'tv',
        status: 'watched',
        start_date: '2026-01-01',
      }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual(['Earlier', 'Later'])
  })

  it('sorts a null start_date after any dated row within the same type/status', () => {
    const rows = buildShowsExportRows([
      makeShow({ title: 'No date', type: 'tv', status: 'want', start_date: null }),
      makeShow({
        title: 'Has date',
        type: 'tv',
        status: 'want',
        start_date: '2026-01-01',
      }),
    ])
    expect(rows.slice(1).map((r) => r[0])).toEqual(['Has date', 'No date'])
  })
})
