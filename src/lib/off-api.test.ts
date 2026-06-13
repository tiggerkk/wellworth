import { describe, expect, it } from 'vitest'
import { mapOffNutriments } from './off-api'

describe('mapOffNutriments', () => {
  it('keeps gram macros as-is and scales minerals/vitamins to our units', () => {
    const map = mapOffNutriments({
      'energy-kcal_100g': 250,
      proteins_100g: 8,
      fat_100g: 5,
      'saturated-fat_100g': 2,
      carbohydrates_100g: 40,
      sodium_100g: 0.5, // g → 500 mg
      calcium_100g: 0.12, // g → 120 mg
      'vitamin-c_100g': 0.03, // g → 30 mg
      'vitamin-d_100g': 0.000005, // g → 5 µg
      selenium_100g: 0.00003, // g → 30 µg
    })
    expect(map.energy).toBe(250)
    expect(map.protein).toBe(8)
    expect(map.saturated).toBe(2)
    expect(map.sodium).toBeCloseTo(500, 6)
    expect(map.calcium).toBeCloseTo(120, 6)
    expect(map.vitamin_c).toBeCloseTo(30, 6)
    expect(map.vitamin_d).toBeCloseTo(5, 6)
    expect(map.selenium).toBeCloseTo(30, 6)
  })

  it('derives sodium from salt when sodium is absent (salt / 2.5)', () => {
    const map = mapOffNutriments({ salt_100g: 1.25 }) // → 0.5 g sodium → 500 mg
    expect(map.sodium).toBeCloseTo(500, 6)
  })

  it('prefers explicit sodium over salt', () => {
    const map = mapOffNutriments({ sodium_100g: 0.2, salt_100g: 1.25 })
    expect(map.sodium).toBeCloseTo(200, 6)
  })

  it('falls back to kJ when kcal is missing (× 0.239)', () => {
    const map = mapOffNutriments({ 'energy-kj_100g': 1000 })
    expect(map.energy).toBeCloseTo(239, 6)
  })

  it('ignores missing / non-numeric fields', () => {
    expect(mapOffNutriments({})).toEqual({})
    expect(mapOffNutriments({ proteins_100g: 'n/a' }).protein).toBeUndefined()
  })
})
