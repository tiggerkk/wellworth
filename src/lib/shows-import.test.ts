import { describe, expect, it } from 'vitest'
import {
  buildImportRow,
  dedupKey,
  parseShowsCsv,
  type ParsedShowRow,
} from './shows-import'
import type { ShowMetadata } from './tmdb-api'

const HEADER = 'title,type,status,rating,lgbtq_rep,watched_seasons,watched_episodes'
const parse = (body: string) =>
  parseShowsCsv(`${HEADER}\n${body}`.split('\n').map((l) => l.split(',')))

describe('parseShowsCsv', () => {
  it('parses a valid row with defaults', () => {
    const { rows, errors } = parse('Dune,movie,want,,,,')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      {
        title: 'Dune',
        type: 'movie',
        status: 'want',
        rating: null,
        lgbtq_rep: 'none', // blank defaults to none
        watched_seasons: null,
        watched_episodes: null,
      },
    ])
  })
  it('keeps TV watched counts and a half-star rating', () => {
    const { rows } = parse('Heartstopper,tv,watching,4.5,significant,1,8')
    expect(rows[0]).toMatchObject({
      type: 'tv',
      status: 'watching',
      rating: 4.5,
      lgbtq_rep: 'significant',
      watched_seasons: 1,
      watched_episodes: 8,
    })
  })
  it('reports the required columns when missing', () => {
    expect(parseShowsCsv([['type', 'status']]).errors[0]).toContain('title')
  })
  it('skips rows with a bad type / status / lgbtq_rep / rating', () => {
    const { rows, errors } = parse(
      [
        'X,book,want,,,,',
        'Y,movie,maybe,,,,',
        'Z,movie,want,,lots,,',
        'W,movie,want,3.3,,,',
      ].join('\n'),
    )
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(4)
  })
})

describe('dedupKey', () => {
  it('is case-insensitive on title and scoped by type', () => {
    expect(dedupKey('  The Matrix ', 'movie')).toBe('movie|the matrix')
    expect(dedupKey('The Matrix', 'tv')).not.toBe(dedupKey('The Matrix', 'movie'))
  })
})

const tvMeta: ShowMetadata = {
  title: 'Breaking Bad',
  original_title: 'Breaking Bad',
  year: 2008,
  poster_path: '/bb.jpg',
  overview: 'x',
  genres: ['Drama'],
  director: 'Vince Gilligan',
  cast: ['Bryan Cranston'],
  runtime_min: 45,
  original_language: 'en',
  total_seasons: 5,
  total_episodes: 62,
  tmdb_id: 1396,
  imdb_id: 'tt0903747',
}

const row = (p: Partial<ParsedShowRow>): ParsedShowRow => ({
  title: 'Breaking Bad',
  type: 'tv',
  status: 'watched',
  rating: null,
  lgbtq_rep: 'none',
  watched_seasons: null,
  watched_episodes: null,
  ...p,
})

describe('buildImportRow', () => {
  it('uses the matched title + metadata and leaves dates null', () => {
    const out = buildImportRow(row({}), tvMeta)
    expect(out.title).toBe('Breaking Bad')
    expect(out.year).toBe(2008)
    expect(out.tmdb_id).toBe(1396)
    expect(out.start_date).toBeNull()
    expect(out.end_date).toBeNull()
    expect(out.last_update_date).toBeNull()
  })
  it('watched TV ⇒ watched counts set to the TMDB totals', () => {
    const out = buildImportRow(row({ status: 'watched' }), tvMeta)
    expect(out.watched_seasons).toBe(5)
    expect(out.watched_episodes).toBe(62)
  })
  it('watching/dropped TV ⇒ the CSV watched counts', () => {
    const out = buildImportRow(
      row({ status: 'dropped', watched_seasons: 2, watched_episodes: 16 }),
      tvMeta,
    )
    expect(out.watched_seasons).toBe(2)
    expect(out.watched_episodes).toBe(16)
  })
  it('movies ⇒ no season/episode counts', () => {
    const out = buildImportRow(row({ type: 'movie', status: 'watched' }), {
      ...tvMeta,
      total_seasons: null,
      total_episodes: null,
    })
    expect(out.total_seasons).toBeNull()
    expect(out.watched_seasons).toBeNull()
  })
  it('falls back to the CSV title with no match', () => {
    const out = buildImportRow(row({ title: 'Unknown Title' }), null)
    expect(out.title).toBe('Unknown Title')
    expect(out.tmdb_id).toBeNull()
    expect(out.poster_path).toBeNull()
  })
})
