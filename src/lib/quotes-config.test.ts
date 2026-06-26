import { describe, expect, it } from 'vitest'
import {
  addCategory,
  addSourceType,
  categoryLabel,
  defaultCategories,
  defaultSourceTypes,
  effectiveCategories,
  effectiveSourceTypes,
  generateKey,
  isProtectedSourceKey,
  linkKindFor,
  matchKeyOrLabel,
  removeCategory,
  renameSourceType,
  reorderCategories,
  sourceTypeLabel,
} from './quotes-config'

describe('defaults', () => {
  it('seed source types in owner order with built-in linkKind', () => {
    const list = defaultSourceTypes()
    expect(list.map((e) => e.key)).toEqual([
      'book',
      'podcast',
      'tv',
      'movie',
      'interview',
      'article',
      'song',
      'video',
    ])
    expect(linkKindFor(list, 'tv')).toBe('show')
    expect(linkKindFor(list, 'movie')).toBe('show')
    expect(linkKindFor(list, 'book')).toBe('book')
    expect(linkKindFor(list, 'interview')).toBeNull()
  })
  it('seed categories in owner order', () => {
    expect(defaultCategories().map((e) => e.key)).toEqual([
      'wit',
      'observation',
      'philosophy',
      'love',
      'relationship',
      'growth',
    ])
  })
  it('protects only the linking source keys', () => {
    expect(isProtectedSourceKey('tv')).toBe(true)
    expect(isProtectedSourceKey('movie')).toBe(true)
    expect(isProtectedSourceKey('book')).toBe(true)
    expect(isProtectedSourceKey('podcast')).toBe(false)
    expect(isProtectedSourceKey('interview')).toBe(false)
  })
})

describe('effectiveSourceTypes / effectiveCategories', () => {
  it('null / empty / all-invalid ⇒ defaults', () => {
    expect(effectiveSourceTypes(null)).toEqual(defaultSourceTypes())
    expect(effectiveSourceTypes([])).toEqual(defaultSourceTypes())
    expect(effectiveSourceTypes('nope')).toEqual(defaultSourceTypes())
    expect(effectiveSourceTypes([{ nope: 1 }])).toEqual(defaultSourceTypes())
    expect(effectiveCategories(null)).toEqual(defaultCategories())
  })
  it('a non-null override is authoritative — a deleted default does NOT resurrect', () => {
    const override = [
      { key: 'wit', label: 'Wit' },
      { key: 'love', label: 'Love' },
    ]
    expect(effectiveCategories(override).map((e) => e.key)).toEqual(['wit', 'love'])
  })
  it('keeps custom keys and de-dupes by key', () => {
    const override = [
      { key: 'wit', label: 'Wit' },
      { key: 'mine', label: 'My Category' },
      { key: 'wit', label: 'Dupe' },
    ]
    expect(effectiveCategories(override).map((e) => e.key)).toEqual(['wit', 'mine'])
  })
  it('forces a canonical key’s linkKind even if the override omits/corrupts it', () => {
    const override = [
      { key: 'tv', label: 'Telly', linkKind: null },
      { key: 'mine', label: 'Mine', linkKind: 'show' },
    ]
    const list = effectiveSourceTypes(override)
    expect(sourceTypeLabel(list, 'tv')).toBe('Telly') // owner label preserved
    expect(linkKindFor(list, 'tv')).toBe('show') // built-in behavior forced back
    expect(linkKindFor(list, 'mine')).toBe('show') // custom linkKind honored
  })
})

describe('tolerant lookups', () => {
  it('falls back to the raw key for an unknown/orphan value', () => {
    expect(categoryLabel(defaultCategories(), 'gone')).toBe('gone')
    expect(sourceTypeLabel(defaultSourceTypes(), 'gone')).toBe('gone')
  })
  it('returns the configured label otherwise', () => {
    expect(categoryLabel(defaultCategories(), 'wit')).toBe('Wit')
    expect(sourceTypeLabel(defaultSourceTypes(), 'tv')).toBe('TV Show')
  })
})

describe('matchKeyOrLabel', () => {
  const list = defaultSourceTypes()
  it('matches by key or label, case-insensitive', () => {
    expect(matchKeyOrLabel(list, 'TV')).toBe('tv')
    expect(matchKeyOrLabel(list, 'tv show')).toBe('tv')
    expect(matchKeyOrLabel(list, '  Movie ')).toBe('movie')
  })
  it('returns null for an unknown or empty cell', () => {
    expect(matchKeyOrLabel(list, 'blog')).toBeNull()
    expect(matchKeyOrLabel(list, '')).toBeNull()
  })
})

describe('generateKey', () => {
  it('slugifies and uniquifies with a numeric suffix', () => {
    expect(generateKey('My Source!', [])).toBe('my_source')
    expect(generateKey('My Source!', ['my_source'])).toBe('my_source_2')
    expect(generateKey('My Source!', ['my_source', 'my_source_2'])).toBe('my_source_3')
  })
  it('falls back to "value" for an empty / symbol-only label', () => {
    expect(generateKey('   ', [])).toBe('value')
    expect(generateKey('中文', ['value'])).toBe('value_2')
  })
})

describe('transforms', () => {
  it('add generates a key (custom source linkKind null) and keeps duplicates labelable', () => {
    const list = addSourceType(defaultSourceTypes(), 'Lecture')
    const added = list[list.length - 1]!
    expect(added).toEqual({ key: 'lecture', label: 'Lecture', linkKind: null })
  })
  it('rename changes only the label, preserving key + linkKind', () => {
    const list = renameSourceType(defaultSourceTypes(), 'tv', 'Telly')
    expect(sourceTypeLabel(list, 'tv')).toBe('Telly')
    expect(linkKindFor(list, 'tv')).toBe('show')
  })
  it('remove drops the entry', () => {
    expect(removeCategory(defaultCategories(), 'wit').some((e) => e.key === 'wit')).toBe(
      false,
    )
  })
  it('reorder respects the given key order and tolerates stale/missing keys', () => {
    const out = reorderCategories(defaultCategories(), ['growth', 'wit', 'ghost'])
    expect(out.slice(0, 2).map((e) => e.key)).toEqual(['growth', 'wit'])
    expect(out.map((e) => e.key).sort()).toEqual(
      defaultCategories()
        .map((e) => e.key)
        .sort(),
    )
  })
  it('add allows a duplicate label but a distinct key', () => {
    const list = addCategory(defaultCategories(), 'Wit')
    expect(list.filter((e) => e.label === 'Wit')).toHaveLength(2)
    expect(new Set(list.map((e) => e.key)).size).toBe(list.length)
  })
})
