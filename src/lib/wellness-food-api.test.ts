import { describe, expect, it } from 'vitest'
import {
  mapUsdaNutrients,
  mapUsdaLabelNutrients,
  toExternalFood,
} from './wellness-food-api'

describe('mapUsdaNutrients', () => {
  it('maps the detail shape (nutrient.number + amount)', () => {
    const map = mapUsdaNutrients({
      fdcId: 1,
      foodNutrients: [
        { nutrient: { number: '208' }, amount: 52 }, // energy
        { nutrient: { number: '203' }, amount: 0.3 }, // protein
        { nutrient: { number: '301' }, amount: 6 }, // calcium mg
        { nutrient: { number: '999' }, amount: 5 }, // unknown → dropped
      ],
    })
    expect(map).toEqual({ energy: 52, protein: 0.3, calcium: 6 })
  })

  it('maps the abridged search shape (nutrientNumber + value)', () => {
    const map = mapUsdaNutrients({
      fdcId: 2,
      foodNutrients: [
        { nutrientNumber: '204', value: 0.2 }, // fat
        { nutrientNumber: '307', value: 1 }, // sodium mg
      ],
    })
    expect(map).toEqual({ fat: 0.2, sodium: 1 })
  })

  it('maps the batch /foods shape (flat number + amount)', () => {
    // POST /v1/foods returns a flat { number, amount, name } per row, distinct from both the
    // search shape and the nested detail shape.
    const map = mapUsdaNutrients({
      fdcId: 4,
      foodNutrients: [
        { number: 203, amount: 14.29 }, // protein
        { number: 208, amount: 500 }, // energy
      ],
    })
    expect(map).toEqual({ protein: 14.29, energy: 500 })
  })

  it('skips non-finite amounts', () => {
    const map = mapUsdaNutrients({ fdcId: 3, foodNutrients: [{ nutrientNumber: '203' }] })
    expect(map).toEqual({})
  })

  it('drops bare {id, amount} rows with no nutrient number (single-item GET /food/{id} shape)', () => {
    // Confirmed live: some Branded records return foodNutrients as bare { type, id, amount } —
    // no nutrient.number, no name, no unit — from GET /food/{fdcId}, even with format=full. This
    // shape can't be mapped (the id is an opaque FoodNutrient row id, not a nutrient number), which
    // is why getUsdaFood no longer uses that endpoint — it uses the batch POST /foods shape instead
    // (see the test above), which reliably includes the nutrient number for the same food.
    const map = mapUsdaNutrients({
      fdcId: 2612538,
      foodNutrients: [
        { type: 'FoodNutrient', id: 32593481, amount: 54.55 },
        { type: 'FoodNutrient', id: 32593488, amount: 864 },
      ] as unknown as { amount: number }[],
    })
    expect(map).toEqual({})
  })
})

describe('mapUsdaLabelNutrients', () => {
  it('maps label-panel fields to our keys', () => {
    const map = mapUsdaLabelNutrients({
      calories: { value: 250 },
      fat: { value: 12 },
      sodium: { value: 470 },
      unknownField: { value: 99 },
    })
    expect(map).toEqual({ energy: 250, fat: 12, sodium: 470 })
  })

  it('skips fields with no numeric value', () => {
    const map = mapUsdaLabelNutrients({ protein: {}, fiber: { value: undefined } })
    expect(map).toEqual({})
  })
})

describe('toExternalFood', () => {
  it('uses per_100g foodNutrients when present, ignoring labelNutrients', () => {
    const f = toExternalFood({
      fdcId: 111,
      description: 'Raw broccoli',
      servingSize: 100,
      servingSizeUnit: 'g',
      foodNutrients: [{ nutrient: { number: '208' }, amount: 34 }],
      labelNutrients: { calories: { value: 999 } },
    })
    expect(f.nutrientBasis).toBe('per_100g')
    expect(f.nutrients).toEqual({ energy: 34 })
  })

  it('falls back to labelNutrients (per_serving) when foodNutrients is empty', () => {
    // Some Branded records do carry a populated labelNutrients panel with an empty
    // foodNutrients array; this covers that case. (The matcha latte / chocolate chip cookie bug
    // reports turned out to hit a different failure mode — see mapUsdaNutrients's
    // "bare {id, amount}" test — where labelNutrients was also empty and getUsdaFood needed to
    // fetch from a different endpoint entirely; this fallback still matters for records where
    // USDA genuinely only populated the label panel.)
    const f = toExternalFood({
      fdcId: 2612538,
      description: 'Matcha Latte',
      servingSize: 355,
      servingSizeUnit: 'ml',
      foodNutrients: [],
      labelNutrients: {
        calories: { value: 120 },
        sugars: { value: 20 },
        sodium: { value: 65 },
      },
    })
    expect(f.nutrientBasis).toBe('per_serving')
    expect(f.nutrients).toEqual({ energy: 120, sugars: 20, sodium: 65 })
  })

  it('stays empty (no crash) when neither foodNutrients nor labelNutrients is usable', () => {
    const f = toExternalFood({ fdcId: 3, description: 'Mystery item', foodNutrients: [] })
    expect(f.nutrients).toEqual({})
    expect(f.nutrientBasis).toBe('per_100g')
  })
})
