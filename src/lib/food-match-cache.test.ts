import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearFoodMatchCache,
  foodMatchCacheSize,
  foodMatchKey,
  getCachedFoodMatch,
  removeCachedFoodMatch,
  setCachedFoodMatch,
} from './food-match-cache'
import type { ExternalFood } from './food-api'

const food = (name: string): ExternalFood => ({
  source: 'usda',
  externalId: '1',
  name,
  brand: null,
  nutrientBasis: 'per_100g',
  nutrients: { energy: 50 },
  servingText: null,
  servingGrams: null,
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

describe('foodMatchKey', () => {
  it('folds case/space and Trad→Simp so variants share one key', () => {
    expect(foodMatchKey('Greek  Yogurt ')).toBe(foodMatchKey('greek yogurt'))
    expect(foodMatchKey('紅蘿蔔')).toBe(foodMatchKey('红萝卜'))
  })
})

describe('food match cache', () => {
  it('misses then hits across case/space variants', () => {
    expect(getCachedFoodMatch('Blueberries')).toBeNull()
    setCachedFoodMatch('Blueberries', food('Blueberries, raw'))
    expect(getCachedFoodMatch('blueberries')?.name).toBe('Blueberries, raw')
    expect(foodMatchCacheSize()).toBe(1)
  })
  it('overwrites (a "Change" correction) and removes (a "Manual")', () => {
    setCachedFoodMatch('Milk', food('Milk, whole'))
    setCachedFoodMatch('Milk', food('Milk, skim'))
    expect(getCachedFoodMatch('milk')?.name).toBe('Milk, skim')
    expect(foodMatchCacheSize()).toBe(1)
    removeCachedFoodMatch('Milk')
    expect(getCachedFoodMatch('Milk')).toBeNull()
  })
  it('clears the whole cache', () => {
    setCachedFoodMatch('Egg', food('Egg, whole'))
    clearFoodMatchCache()
    expect(foodMatchCacheSize()).toBe(0)
  })
})
