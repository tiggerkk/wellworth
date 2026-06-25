import { describe, expect, it } from 'vitest'
import {
  buildImportRow,
  dedupKey,
  parseShowsCsv,
  type ParsedShowRow,
} from './shows-import'
import type { ShowMetadata } from './tmdb-api'

const HEADER =
  'title,type,status,rating,lgbtq_rep,watched_seasons,watched_episodes,is_favorite,start_date,end_date'
const parse = (body: string) =>
  parseShowsCsv(`${HEADER}\n${body}`.split('\n').map((l) => l.split(',')))

describe('parseShowsCsv', () => {
  it('parses a valid row with defaults', () => {
    const { rows, errors } = parse('Dune,movie,want,,,,,,2023-01-01,')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      {
        title: 'Dune',
        type: 'movie',
        status: 'want',
        rating: null,
        lgbtq_rep: 'none', // blank defaults to none
        dynasty: null, // blank → null (and only kept for Chinese titles)
        watched_seasons: null,
        watched_episodes: null,
        is_favorite: false, // blank → false
        start_date: '2023-01-01',
        end_date: null, // ignored for an unfinished (want) row
      },
    ])
  })
  it('allows a blank start_date only for a want row', () => {
    const want = parse('Dune,movie,want,,,,,,,')
    expect(want.errors).toEqual([])
    expect(want.rows[0]).toMatchObject({
      status: 'want',
      start_date: null,
      end_date: null,
    })
    expect(parse('Dune,movie,watching,,,,,,,').errors).toHaveLength(1) // non-want needs start_date
    expect(parse('Dune,movie,want,,,,,,bad,').errors).toHaveLength(1) // malformed still rejected
  })
  it('requires end_date for finished (watched/dropped) rows', () => {
    expect(parse('Dune,movie,watched,,,,,,2023-01-01,').errors).toHaveLength(1) // watched needs end_date
    const ok = parse('Dune,movie,watched,,,,,,2023-01-01,2023-02-01')
    expect(ok.errors).toEqual([])
    expect(ok.rows[0]).toMatchObject({ start_date: '2023-01-01', end_date: '2023-02-01' })
  })
  it('keeps TV watched counts, a half-star rating, and a favourite flag', () => {
    const { rows } = parse(
      'Heartstopper,tv,watching,4.5,significant,1,8,true,2023-01-01,',
    )
    expect(rows[0]).toMatchObject({
      type: 'tv',
      status: 'watching',
      rating: 4.5,
      lgbtq_rep: 'significant',
      watched_seasons: 1,
      watched_episodes: 8,
      is_favorite: true,
    })
  })
  it('accepts watched_episodes "all" on a watching/dropped episodic row', () => {
    const { rows, errors } = parse('Breaking Bad,tv,watching,,,2,all,,2023-01-01,')
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ watched_seasons: 2, watched_episodes: 'all' })
  })
  it('rejects "all" without a watched_seasons, on a movie, or on a non-progress status', () => {
    expect(parse('Breaking Bad,tv,watching,,,,all,').errors).toHaveLength(1) // no season
    expect(parse('Dune,movie,watching,,,1,all,').errors).toHaveLength(1) // not episodic
    expect(parse('Breaking Bad,tv,watched,,,2,all,').errors).toHaveLength(1) // not in progress
    expect(parse('Breaking Bad,tv,watching,,,,all,').rows).toHaveLength(0)
  })
  it('parses is_favorite leniently (yes/1/y ⇒ true, else false)', () => {
    expect(parse('A,movie,want,,,,,yes,2023-01-01,').rows[0]?.is_favorite).toBe(true)
    expect(parse('B,movie,want,,,,,1,2023-01-01,').rows[0]?.is_favorite).toBe(true)
    expect(parse('C,movie,want,,,,,no,2023-01-01,').rows[0]?.is_favorite).toBe(false)
  })
  it('accepts a documentary (Chinese title)', () => {
    const { rows, errors } = parse(
      '从东晋到北魏,documentary,watched,,,,,,2023-01-01,2023-02-01',
    )
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({
      title: '从东晋到北魏',
      type: 'documentary',
      status: 'watched',
    })
  })
  it('reports the required columns when missing', () => {
    expect(parseShowsCsv([['type', 'status']]).errors[0]).toContain('title')
  })
  it('skips rows with a bad type / status / lgbtq_rep / rating', () => {
    const { rows, errors } = parse(
      [
        'X,book,want,,,,,',
        'Y,movie,maybe,,,,,',
        'Z,movie,want,,lots,,,',
        'W,movie,want,3.3,,,,',
      ].join('\n'),
    )
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(4)
  })
})

describe('dedupKey', () => {
  it('is case-insensitive on title (type-agnostic)', () => {
    expect(dedupKey('  The Matrix ')).toBe('the matrix')
    expect(dedupKey('从东晋到北魏')).toBe('从东晋到北魏')
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
  season_episode_counts: { 1: 7, 2: 13, 3: 13, 4: 13, 5: 16 },
  tmdb_id: 1396,
  imdb_id: 'tt0903747',
}

const row = (p: Partial<ParsedShowRow>): ParsedShowRow => ({
  title: 'Breaking Bad',
  type: 'tv',
  status: 'watched',
  rating: null,
  lgbtq_rep: 'none',
  dynasty: null,
  watched_seasons: null,
  watched_episodes: null,
  is_favorite: false,
  start_date: '2023-01-01',
  end_date: '2023-02-01',
  ...p,
})

describe('buildImportRow', () => {
  it('uses the matched title + metadata and carries the CSV dates (created_at = start_date)', () => {
    const out = buildImportRow(row({}), tvMeta)
    expect(out.title).toBe('Breaking Bad')
    expect(out.year).toBe(2008)
    expect(out.tmdb_id).toBe(1396)
    expect(out.start_date).toBe('2023-01-01')
    expect(out.end_date).toBe('2023-02-01')
    expect(out.created_at).toBe('2023-01-01T00:00:00Z')
  })
  it('carries is_favorite through', () => {
    expect(buildImportRow(row({ is_favorite: true }), tvMeta).is_favorite).toBe(true)
  })
  it('a want row with no start_date omits created_at (defaults to now() = updated_at)', () => {
    const out = buildImportRow(
      row({ status: 'want', start_date: null, end_date: null }),
      null,
    )
    expect(out.start_date).toBeNull()
    expect(out.created_at).toBeUndefined()
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
  it('watching "all" ⇒ the last-watched season’s TMDB episode count', () => {
    const out = buildImportRow(
      row({ status: 'watching', watched_seasons: 2, watched_episodes: 'all' }),
      tvMeta,
    )
    expect(out.watched_seasons).toBe(2)
    expect(out.watched_episodes).toBe(13) // season 2 has 13 episodes
  })
  it('"all" ⇒ null episodes when TMDB has no count for that season (or no match)', () => {
    expect(
      buildImportRow(
        row({ status: 'dropped', watched_seasons: 9, watched_episodes: 'all' }),
        tvMeta,
      ).watched_episodes,
    ).toBeNull()
    expect(
      buildImportRow(
        row({ status: 'watching', watched_seasons: 2, watched_episodes: 'all' }),
        null,
      ).watched_episodes,
    ).toBeNull()
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
  it('documentaries are episodic', () => {
    const out = buildImportRow(row({ type: 'documentary', status: 'watched' }), {
      ...tvMeta,
      total_seasons: 1,
      total_episodes: 12,
    })
    expect(out.total_episodes).toBe(12)
    expect(out.watched_episodes).toBe(12)
  })
  it('falls back to the CSV title with no match', () => {
    const out = buildImportRow(row({ title: 'Unknown Title' }), null)
    expect(out.title).toBe('Unknown Title')
    expect(out.tmdb_id).toBeNull()
    expect(out.poster_path).toBeNull()
  })
})
