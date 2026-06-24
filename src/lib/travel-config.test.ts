import { describe, expect, it } from 'vitest'
import {
  addCategory,
  categoryLabel,
  defaultCategories,
  effectiveCategories,
  generateKey,
  matchKeyOrLabel,
  removeCategory,
  renameCategory,
  reorderCategories,
} from './travel-config'

describe('defaults', () => {
  it('seed categories in owner order', () => {
    expect(defaultCategories().map((e) => e.key)).toEqual([
      'restaurant',
      'takeout',
      'groceries',
      'shopping',
      'activity',
      'local_transit',
      'flight_train',
      'hotel',
    ])
  })
})

describe('effectiveCategories', () => {
  it('null / empty / all-invalid ⇒ defaults', () => {
    expect(effectiveCategories(null)).toEqual(defaultCategories())
    expect(effectiveCategories([])).toEqual(defaultCategories())
    expect(effectiveCategories('nope')).toEqual(defaultCategories())
    expect(effectiveCategories([{ nope: 1 }])).toEqual(defaultCategories())
  })
  it('a non-null override is authoritative — a deleted default does NOT resurrect', () => {
    const override = [
      { key: 'restaurant', label: 'Restaurant' },
      { key: 'hotel', label: 'Hotel' },
    ]
    expect(effectiveCategories(override).map((e) => e.key)).toEqual([
      'restaurant',
      'hotel',
    ])
  })
  it('keeps custom keys and de-dupes by key', () => {
    const override = [
      { key: 'restaurant', label: 'Restaurant' },
      { key: 'mine', label: 'My Category' },
      { key: 'restaurant', label: 'Dupe' },
    ]
    expect(effectiveCategories(override).map((e) => e.key)).toEqual([
      'restaurant',
      'mine',
    ])
  })
})

describe('tolerant lookups', () => {
  it('falls back to the raw key for an unknown/orphan value', () => {
    expect(categoryLabel(defaultCategories(), 'gone')).toBe('gone')
  })
  it('returns the configured label otherwise', () => {
    expect(categoryLabel(defaultCategories(), 'flight_train')).toBe('Flight/Train')
  })
})

describe('matchKeyOrLabel', () => {
  const list = defaultCategories()
  it('matches by key or label, case-insensitive', () => {
    expect(matchKeyOrLabel(list, 'flight_train')).toBe('flight_train')
    expect(matchKeyOrLabel(list, 'Flight/Train')).toBe('flight_train')
    expect(matchKeyOrLabel(list, '  Local Transit ')).toBe('local_transit')
    expect(matchKeyOrLabel(list, 'HOTEL')).toBe('hotel')
  })
  it('returns null for an unknown or empty cell', () => {
    expect(matchKeyOrLabel(list, 'gifts')).toBeNull()
    expect(matchKeyOrLabel(list, '')).toBeNull()
  })
})

describe('generateKey', () => {
  it('slugifies and uniquifies with a numeric suffix', () => {
    expect(generateKey('My Category!', [])).toBe('my_category')
    expect(generateKey('My Category!', ['my_category'])).toBe('my_category_2')
    expect(generateKey('My Category!', ['my_category', 'my_category_2'])).toBe(
      'my_category_3',
    )
  })
  it('falls back to "value" for an empty / symbol-only label', () => {
    expect(generateKey('   ', [])).toBe('value')
    expect(generateKey('中文', ['value'])).toBe('value_2')
  })
})

describe('transforms', () => {
  it('add generates a key and allows a duplicate label with a distinct key', () => {
    const list = addCategory(defaultCategories(), 'Hotel')
    expect(list.filter((e) => e.label === 'Hotel')).toHaveLength(2)
    expect(new Set(list.map((e) => e.key)).size).toBe(list.length)
  })
  it('rename changes only the label, preserving the key', () => {
    const list = renameCategory(defaultCategories(), 'hotel', 'Lodging')
    expect(categoryLabel(list, 'hotel')).toBe('Lodging')
    expect(list.some((e) => e.key === 'hotel')).toBe(true)
  })
  it('remove drops the entry', () => {
    expect(
      removeCategory(defaultCategories(), 'hotel').some((e) => e.key === 'hotel'),
    ).toBe(false)
  })
  it('reorder respects the given key order and tolerates stale/missing keys', () => {
    const out = reorderCategories(defaultCategories(), ['hotel', 'restaurant', 'ghost'])
    expect(out.slice(0, 2).map((e) => e.key)).toEqual(['hotel', 'restaurant'])
    expect(out.map((e) => e.key).sort()).toEqual(
      defaultCategories()
        .map((e) => e.key)
        .sort(),
    )
  })
})
