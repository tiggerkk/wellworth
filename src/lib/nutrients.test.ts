import { describe, expect, it } from 'vitest'
import {
  basisGrams,
  deriveNetCarbs,
  filterToKnownKeys,
  isOverUpperLimit,
  percentOfTarget,
  scaleNutrients,
  sumNutrients,
} from './nutrients'
import type { NutrientDri } from './dri'

describe('basisGrams', () => {
  it('is 100 for per_100g and the serving grams for per_serving', () => {
    expect(basisGrams('per_100g', 240)).toBe(100)
    expect(basisGrams('per_serving', 240)).toBe(240)
  })
})

describe('scaleNutrients', () => {
  it('scales a per-100g map by amount × servingGrams / 100', () => {
    // 2 servings of 150 g, value per 100 g = 10 → 10 * (2*150)/100 = 30
    expect(
      scaleNutrients({ protein: 10 }, { amount: 2, servingGrams: 150, basisGrams: 100 }),
    ).toEqual({ protein: 30 })
  })

  it('scales a per-serving map (basis = serving grams) by amount', () => {
    // per serving: 1 capsule; amount 2 → factor (2*500)/500 = 2
    expect(
      scaleNutrients(
        { vitamin_d: 25 },
        { amount: 2, servingGrams: 500, basisGrams: 500 },
      ),
    ).toEqual({ vitamin_d: 50 })
  })
})

describe('sumNutrients / deriveNetCarbs', () => {
  it('sums element-wise across maps', () => {
    expect(sumNutrients([{ protein: 10, fat: 2 }, { protein: 5 }, {}])).toEqual({
      protein: 15,
      fat: 2,
    })
  })

  it('derives net carbs as carbs − fiber, and is a no-op without carbs', () => {
    expect(deriveNetCarbs({ carbs: 30, fiber: 8 }).net_carbs).toBe(22)
    expect(deriveNetCarbs({ protein: 5 }).net_carbs).toBeUndefined()
  })
})

describe('percentOfTarget', () => {
  it('computes a percentage and guards null/zero targets', () => {
    expect(percentOfTarget(45, 90)).toBe(50)
    expect(percentOfTarget(45, null)).toBeNull()
    expect(percentOfTarget(45, 0)).toBeNull()
  })
})

describe('isOverUpperLimit', () => {
  const dri = (ul: number | null, ulScope: NutrientDri['ulScope']): NutrientDri => ({
    target: null,
    targetType: 'none',
    ul,
    ulScope,
  })

  it('fires for total / cdrr / guidance limits when exceeded', () => {
    expect(isOverUpperLimit(2100, dri(2000, 'total'))).toBe(true)
    expect(isOverUpperLimit(2400, dri(2300, 'cdrr'))).toBe(true)
    expect(isOverUpperLimit(60, dri(50, 'guidance'))).toBe(true)
    expect(isOverUpperLimit(1900, dri(2000, 'total'))).toBe(false)
  })

  it('never fires for supplemental-only limits (e.g. dietary magnesium)', () => {
    expect(isOverUpperLimit(500, dri(350, 'supplemental'))).toBe(false)
  })

  it('never fires when there is no UL', () => {
    expect(isOverUpperLimit(9999, dri(null, null))).toBe(false)
  })
})

describe('filterToKnownKeys', () => {
  it('drops unknown keys and undefined values', () => {
    const known = new Set(['protein', 'fat'])
    expect(filterToKnownKeys({ protein: 10, mystery: 5, fat: undefined }, known)).toEqual(
      {
        protein: 10,
      },
    )
  })
})
