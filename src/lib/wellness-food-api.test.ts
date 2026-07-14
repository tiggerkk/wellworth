import { describe, expect, it } from 'vitest'
import { mapUsdaNutrients } from './wellness-food-api'

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

  it('skips non-finite amounts', () => {
    const map = mapUsdaNutrients({ fdcId: 3, foodNutrients: [{ nutrientNumber: '203' }] })
    expect(map).toEqual({})
  })
})
