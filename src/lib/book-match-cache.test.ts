import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bookMatchCacheSize,
  bookMatchKey,
  clearBookMatchCache,
  getCachedBookMatch,
  removeCachedBookMatch,
  setCachedBookMatch,
} from './book-match-cache'
import type { BookMetadata } from './books-api'

const meta = (title: string): BookMetadata => ({
  title,
  authors: ['A'],
  year: 2000,
  cover_url: null,
  description: null,
  genres: null,
  page_count: null,
  language: null,
  isbn: null,
  google_books_id: 'g',
  open_library_id: null,
})

// vitest runs in the `node` env (no DOM), so provide a minimal in-memory localStorage.
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

describe('bookMatchKey', () => {
  it('folds Trad→Simp so script variants share one key', () => {
    expect(bookMatchKey('紅樓夢', '曹雪芹')).toBe(bookMatchKey('红楼梦', '曹雪芹'))
  })
  it('normalizes case and whitespace', () => {
    expect(bookMatchKey('The  Hobbit ', 'J.R.R. Tolkien')).toBe(
      bookMatchKey('the hobbit', 'j.r.r. tolkien'),
    )
  })
  it('tolerates a missing author', () => {
    expect(bookMatchKey('Dune', null)).toBe(bookMatchKey('Dune', undefined))
  })
})

describe('book match cache', () => {
  it('misses then hits across case/space variants', () => {
    expect(getCachedBookMatch('Dune', 'Frank Herbert')).toBeNull()
    setCachedBookMatch('Dune', 'Frank Herbert', meta('Dune'))
    expect(getCachedBookMatch('dune', 'frank herbert')?.title).toBe('Dune')
    expect(bookMatchCacheSize()).toBe(1)
  })
  it('overwrites an existing entry (a "Change" correction)', () => {
    setCachedBookMatch('Dune', 'Herbert', meta('Wrong Dune'))
    setCachedBookMatch('Dune', 'Herbert', meta('Right Dune'))
    expect(getCachedBookMatch('Dune', 'Herbert')?.title).toBe('Right Dune')
    expect(bookMatchCacheSize()).toBe(1)
  })
  it('removes a single entry without touching the others', () => {
    setCachedBookMatch('Dune', 'Frank Herbert', meta('Dune'))
    setCachedBookMatch('It', 'Stephen King', meta('It'))
    removeCachedBookMatch('Dune', 'Frank Herbert')
    expect(getCachedBookMatch('Dune', 'Frank Herbert')).toBeNull()
    expect(getCachedBookMatch('It', 'Stephen King')?.title).toBe('It')
  })
  it('clears the whole cache', () => {
    setCachedBookMatch('Dune', 'Frank Herbert', meta('Dune'))
    clearBookMatchCache()
    expect(bookMatchCacheSize()).toBe(0)
  })
  it('ignores a stale-version blob', () => {
    localStorage.setItem(
      'wellworth:book-match-cache',
      JSON.stringify({ version: 999, entries: { x: meta('X') } }),
    )
    expect(bookMatchCacheSize()).toBe(0)
  })
  it('survives disabled/corrupt storage without throwing', () => {
    localStorage.setItem('wellworth:book-match-cache', 'not json')
    expect(getCachedBookMatch('Dune', 'Herbert')).toBeNull()
    expect(() => setCachedBookMatch('Dune', 'Herbert', meta('Dune'))).not.toThrow()
  })
})
