import { describe, expect, it } from 'vitest'
import {
  applyPoemView,
  groupWritersByDynasty,
  sortPoems,
  type LiteratureType,
  type PoemIndexEntry,
  type WriterLite,
} from './literature'

const TYPES: LiteratureType[] = [
  { id: 1, name: '春', kind: 'season', sortOrder: 0 },
  { id: 2, name: '秋', kind: 'season', sortOrder: 2 },
  { id: 3, name: '唐詩三百首', kind: 'anthology', sortOrder: 0 },
  { id: 4, name: '愛國', kind: 'theme', sortOrder: 0 },
]
const typesById = new Map(TYPES.map((t) => [t.id, t]))

const POEMS: PoemIndexEntry[] = [
  {
    id: 1,
    title: '靜夜思',
    writerId: 5,
    writer: '李白',
    dynasty: '唐代',
    typeIds: [2, 3],
    excerpt: '床前明月光',
  },
  {
    id: 2,
    title: '春曉',
    writerId: 6,
    writer: '孟浩然',
    dynasty: '唐代',
    typeIds: [1],
    excerpt: '春眠不覺曉',
  },
  {
    id: 3,
    title: '示兒',
    writerId: 7,
    writer: '陸游',
    dynasty: '宋代',
    typeIds: [4],
    excerpt: '死去元知萬事空',
  },
]

function view(
  criteria: Partial<Parameters<typeof applyPoemView>[1]>,
  favoriteIds = new Set<number>(),
) {
  return applyPoemView(
    POEMS,
    {
      query: '',
      dynasty: null,
      typeIds: [],
      favoritesOnly: false,
      sortField: 'dynasty',
      sortDir: 'asc',
      ...criteria,
    },
    { typesById, favoriteIds },
  ).map((p) => p.id)
}

describe('applyPoemView', () => {
  it('returns everything with empty criteria', () => {
    expect(view({})).toEqual([1, 2, 3])
  })

  it('search matches title/author/excerpt and is Traditional⇄Simplified agnostic', () => {
    expect(view({ query: '李白' })).toEqual([1])
    // Simplified query must match the stored Traditional title (静 → 靜) via foldZh.
    expect(view({ query: '静夜' })).toEqual([1])
    expect(view({ query: '明月' })).toEqual([1]) // excerpt match
  })

  it('filters by exact dynasty', () => {
    expect(view({ dynasty: '宋代' })).toEqual([3])
    expect(view({ dynasty: '唐代' })).toEqual([1, 2])
  })

  it('ORs type ids within a kind-group', () => {
    // 春 (1) OR 秋 (2) — both seasons → poems 1 and 2.
    expect(view({ typeIds: [1, 2] })).toEqual([1, 2])
  })

  it('ANDs across kind-groups', () => {
    // season 秋 (2) AND anthology 唐詩三百首 (3) → only poem 1.
    expect(view({ typeIds: [2, 3] })).toEqual([1])
    // season 春 (1) AND anthology 唐詩三百首 (3) → none (poem 2 has season but not the anthology).
    expect(view({ typeIds: [1, 3] })).toEqual([])
  })

  it('filters to favourites only', () => {
    expect(view({ favoritesOnly: true }, new Set([2]))).toEqual([2])
    expect(view({ favoritesOnly: true }, new Set())).toEqual([])
  })
})

describe('sortPoems', () => {
  const order = ['唐代', '宋代'] // chronological corpus order (meta.dynasties)
  const ids = (
    field: Parameters<typeof sortPoems>[1],
    dir: Parameters<typeof sortPoems>[2],
  ) => sortPoems(POEMS, field, dir, order).map((p) => p.id)

  it('sorts by dynasty chronologically, then title; desc flips the groups', () => {
    expect(ids('dynasty', 'asc')).toEqual([2, 1, 3]) // 唐代 (春曉, 靜夜思) then 宋代
    expect(ids('dynasty', 'desc')).toEqual([3, 2, 1]) // 宋代 first; title tiebreak stays ascending
  })

  it('sorts by author and title', () => {
    expect(ids('author', 'asc')).toEqual([2, 1, 3]) // 孟浩然 < 李白 < 陸游
    expect(ids('title', 'asc')).toEqual([2, 3, 1]) // 春曉 < 示兒 < 靜夜思
    expect(ids('title', 'desc')).toEqual([1, 3, 2])
  })

  it('puts a poem with an unknown/absent dynasty last regardless of direction', () => {
    const withUnknown: PoemIndexEntry[] = [
      ...POEMS,
      {
        id: 4,
        title: '佚題',
        writerId: 9,
        writer: '佚名',
        dynasty: null,
        typeIds: [],
        excerpt: '',
      },
    ]
    expect(sortPoems(withUnknown, 'dynasty', 'asc', order).at(-1)?.id).toBe(4)
    expect(sortPoems(withUnknown, 'dynasty', 'desc', order).at(-1)?.id).toBe(4)
  })

  it('does not mutate its input', () => {
    const copy = POEMS.map((p) => p.id)
    sortPoems(POEMS, 'title', 'desc', order)
    expect(POEMS.map((p) => p.id)).toEqual(copy)
  })
})

describe('groupWritersByDynasty', () => {
  const writers: WriterLite[] = [
    { id: 1, name: '陸游', dynasty: '宋代' },
    { id: 2, name: '李白', dynasty: '唐代' },
    { id: 3, name: '杜甫', dynasty: '唐代' },
  ]

  it('groups by dynasty in corpus order, writers sorted within', () => {
    const groups = groupWritersByDynasty(writers, ['唐代', '宋代'])
    expect(groups.map((g) => g.dynasty)).toEqual(['唐代', '宋代'])
    expect(groups[0]?.writers.map((w) => w.name)).toEqual(
      ['李白', '杜甫'].sort((a, b) => a.localeCompare(b)),
    )
  })
})
