import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMatchCache } from './match-cache'

function memoryStorage(opts?: { rejectValue?: (v: string) => boolean }): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      // Simulate a full store: reject oversized payloads, accept the smaller reset blob.
      if (opts?.rejectValue?.(String(v))) throw new DOMException('QuotaExceededError')
      m.set(k, String(v))
    },
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
  } as Storage
}

const cacheA = () =>
  createMatchCache<{ id: string }, { v: number }>({
    storageKey: 'test:a',
    version: 1,
    keyFn: ({ id }) => id.toLowerCase(),
  })

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createMatchCache', () => {
  it('does the CRUD basics with a normalizing key', () => {
    const c = cacheA()
    expect(c.get({ id: 'X' })).toBeNull()
    c.set({ id: 'X' }, { v: 1 })
    expect(c.get({ id: 'x' })).toEqual({ v: 1 }) // key folds case
    expect(c.size()).toBe(1)
    c.remove({ id: 'x' })
    expect(c.get({ id: 'X' })).toBeNull()
  })

  it('keeps two instances isolated by storage key', () => {
    const a = cacheA()
    const b = createMatchCache<{ id: string }, { v: number }>({
      storageKey: 'test:b',
      version: 1,
      keyFn: ({ id }) => id,
    })
    a.set({ id: 'k' }, { v: 1 })
    b.set({ id: 'k' }, { v: 2 })
    expect(a.get({ id: 'k' })).toEqual({ v: 1 })
    expect(b.get({ id: 'k' })).toEqual({ v: 2 })
    a.clear()
    expect(a.size()).toBe(0)
    expect(b.size()).toBe(1) // clearing one doesn't touch the other
  })

  it('ignores a stale-version blob', () => {
    localStorage.setItem(
      'test:a',
      JSON.stringify({ version: 99, entries: { x: { v: 1 } } }),
    )
    expect(cacheA().size()).toBe(0)
  })

  it('survives corrupt JSON without throwing', () => {
    localStorage.setItem('test:a', 'not json')
    const c = cacheA()
    expect(c.get({ id: 'x' })).toBeNull()
    expect(() => c.set({ id: 'x' }, { v: 1 })).not.toThrow()
  })

  it('on a quota-exceeded write, resets to just the new entry', () => {
    // Reject the merged 2-entry blob (the "store is full" case); the smaller reset blob succeeds.
    vi.stubGlobal(
      'localStorage',
      memoryStorage({ rejectValue: (v) => v.includes('first') && v.includes('second') }),
    )
    const c = cacheA()
    c.set({ id: 'first' }, { v: 1 })
    c.set({ id: 'second' }, { v: 2 })
    expect(c.get({ id: 'second' })).toEqual({ v: 2 })
    expect(c.get({ id: 'first' })).toBeNull()
    expect(c.size()).toBe(1)
  })
})
