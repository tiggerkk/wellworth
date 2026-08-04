import { describe, expect, it } from 'vitest'
import { buildFoodExportRows } from './wellness-food-export'
import type { Tables } from '../types/database'

type FoodRow = Tables<'food'>
type ServingRow = Tables<'serving'>

function makeFood(overrides: Partial<FoodRow> = {}): FoodRow {
  return {
    id: 'f1',
    user_id: 'u1',
    source: 'custom',
    external_id: null,
    name: 'Food Name',
    type: 'food',
    nutrient_basis: 'per_100g',
    nutrients: {},
    is_favorite: false,
    default_serving_id: null,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeServing(overrides: Partial<ServingRow> = {}): ServingRow {
  return {
    id: 'srv1',
    food_id: 'f1',
    name: '1 cup',
    grams: 100,
    ...overrides,
  }
}

const NUTRIENT_ORDER = ['energy', 'protein', 'carbs', 'fat']

describe('buildFoodExportRows', () => {
  it('emits the core header columns when no nutrient keys are given', () => {
    const rows = buildFoodExportRows([makeFood()], new Map(), [])
    expect(rows[0]).toEqual([
      'name',
      'type',
      'is_custom',
      'is_favorite',
      'nutrient_basis',
      'serving1_name',
      'serving1_grams',
      'serving2_name',
      'serving2_grams',
      'serving3_name',
      'serving3_grams',
      'default_serving',
    ])
  })

  it('includes every nutrient column, in canonical order, even when unused', () => {
    const rows = buildFoodExportRows([makeFood()], new Map(), NUTRIENT_ORDER)
    expect(rows[0]?.slice(12)).toEqual(['energy', 'protein', 'carbs', 'fat'])
  })

  it('orders nutrient columns per the canonical reference order, not usage order', () => {
    const rows = buildFoodExportRows(
      [makeFood({ nutrients: { fat: 5, protein: 10, energy: 100 } })],
      new Map(),
      NUTRIENT_ORDER,
    )
    expect(rows[1]?.slice(12)).toEqual(['100', '10', '', '5'])
  })

  it('leaves an unset nutrient cell blank on a custom food', () => {
    const rows = buildFoodExportRows(
      [makeFood({ source: 'custom', nutrients: { protein: 20, energy: null } })],
      new Map(),
      NUTRIENT_ORDER,
    )
    expect(rows[1]?.slice(12)).toEqual(['', '20', '', ''])
  })

  it('exports is_custom "true" only for a custom food; USDA blank', () => {
    const rows = buildFoodExportRows(
      [makeFood({ id: 'a', source: 'custom' }), makeFood({ id: 'b', source: 'usda' })],
      new Map(),
      [],
    )
    expect(rows[1]?.[2]).toBe('true')
    expect(rows[2]?.[2]).toBe('')
  })

  it('exports nutrient cells blank for a USDA food even though the row has cached nutrients', () => {
    const rows = buildFoodExportRows(
      [makeFood({ source: 'usda', nutrients: { protein: 20 } })],
      new Map(),
      ['protein'],
    )
    expect(rows[0]?.slice(12)).toEqual(['protein'])
    expect(rows[1]?.slice(12)).toEqual([''])
  })

  it('exports up to 3 servings into the fixed slots, ordered as given', () => {
    const servings = new Map([
      [
        'f1',
        [
          makeServing({ id: 's1', name: '1 cup', grams: 100 }),
          makeServing({ id: 's2', name: '1 tbsp', grams: 15 }),
        ],
      ],
    ])
    const rows = buildFoodExportRows([makeFood({ id: 'f1' })], servings, [])
    expect(rows[1]?.slice(5, 11)).toEqual(['1 cup', '100', '1 tbsp', '15', '', ''])
  })

  it('drops servings beyond the first 3', () => {
    const servings = new Map([
      [
        'f1',
        [
          makeServing({ id: 's1', name: 'a', grams: 1 }),
          makeServing({ id: 's2', name: 'b', grams: 2 }),
          makeServing({ id: 's3', name: 'c', grams: 3 }),
          makeServing({ id: 's4', name: 'd', grams: 4 }),
        ],
      ],
    ])
    const rows = buildFoodExportRows([makeFood({ id: 'f1' })], servings, [])
    expect(rows[1]?.slice(5, 11)).toEqual(['a', '1', 'b', '2', 'c', '3'])
  })

  it('resolves default_serving to the matching serving name by default_serving_id', () => {
    const servings = new Map([
      [
        'f1',
        [
          makeServing({ id: 's1', name: '1 cup', grams: 100 }),
          makeServing({ id: 's2', name: '1 tbsp', grams: 15 }),
        ],
      ],
    ])
    const rows = buildFoodExportRows(
      [makeFood({ id: 'f1', default_serving_id: 's2' })],
      servings,
      [],
    )
    expect(rows[1]?.[11]).toBe('1 tbsp')
  })

  it('exports an empty default_serving when default_serving_id is null or unmatched', () => {
    const rows = buildFoodExportRows(
      [makeFood({ id: 'f1', default_serving_id: null })],
      new Map(),
      [],
    )
    expect(rows[1]?.[11]).toBe('')
  })

  it('sorts foods by name ascending', () => {
    const rows = buildFoodExportRows(
      [
        makeFood({ id: 'a', name: 'Zucchini' }),
        makeFood({ id: 'b', name: 'Apple' }),
        makeFood({ id: 'c', name: 'Mango' }),
      ],
      new Map(),
      [],
    )
    expect(rows.slice(1).map((r) => r[0])).toEqual(['Apple', 'Mango', 'Zucchini'])
  })

  it('exports is_favorite as "true" only when true, else empty', () => {
    const favRows = buildFoodExportRows([makeFood({ is_favorite: true })], new Map(), [])
    expect(favRows[1]?.[3]).toBe('true')
    const notFavRows = buildFoodExportRows(
      [makeFood({ is_favorite: false })],
      new Map(),
      [],
    )
    expect(notFavRows[1]?.[3]).toBe('')
  })
})
