import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportFoodResolved } from './food'

// Minimal in-memory stand-in for the two tables saveImportedFoods touches. It enforces the same
// rule as the partial unique index (one active row per user/source/external_id), so a batch that
// queues the same USDA food twice fails exactly as it would against Postgres.
type FoodRow = Record<string, unknown> & { id: string }
let foods: FoodRow[] = []
let servings: Record<string, unknown>[] = []
let nextId = 1

vi.mock('../lib/supabase', () => {
  const uniqueKey = (r: Record<string, unknown>) =>
    r.external_id != null && r.deleted_at == null
      ? `${r.user_id}|${r.source}|${r.external_id}`
      : null
  const from = (table: string) => ({
    select: () => ({
      is: () => ({
        order: async () => ({
          data: foods.filter((f) => f.deleted_at == null),
          error: null,
        }),
      }),
    }),
    insert: (rows: Record<string, unknown>[]) => ({
      select: async () => {
        if (table === 'food') {
          const seen = new Set(foods.map((f) => uniqueKey(f)).filter(Boolean))
          for (const r of rows) {
            const k = uniqueKey(r)
            if (k && seen.has(k)) {
              return { data: null, error: { code: '23505', message: 'duplicate key' } }
            }
            if (k) seen.add(k)
          }
        }
        const out = rows.map((r) => ({ id: `${table}${nextId++}`, ...r }))
        if (table === 'food') foods.push(...(out as FoodRow[]))
        else servings.push(...out)
        return { data: out, error: null }
      },
    }),
    upsert: async () => ({ error: null }),
  })
  return { supabase: { from } }
})

vi.mock('./serving', () => ({
  replaceServings: vi.fn(async () => []),
  resolveDefaultServingId: vi.fn(() => null),
}))
vi.mock('./diary-entry', () => ({ foodHasEntries: vi.fn(async () => false) }))

import { saveImportedFoods } from './food'

const USER = 'u1'
const usda = (externalId: string, name: string): ImportFoodResolved => ({
  input: {
    name,
    type: 'food',
    nutrient_basis: 'per_100g',
    is_custom: false,
    is_favorite: false,
    nutrients: {},
    servings: [],
    default_serving_name: null,
  },
  match: {
    externalId,
    name,
    nutrients: { energy: 100 },
    nutrientBasis: 'per_100g',
    servingText: null,
    servingGrams: null,
  },
})

beforeEach(() => {
  foods = []
  servings = []
  nextId = 1
})

describe('saveImportedFoods with duplicate USDA matches in one batch', () => {
  it('queues one row per USDA food instead of failing the whole insert', async () => {
    const res = await saveImportedFoods(USER, [
      usda('111', 'Oats'),
      usda('222', 'Rice'),
      usda('111', 'Rolled oats'),
    ])
    expect(foods.map((f) => f.external_id).sort()).toEqual(['111', '222'])
    expect(res).toEqual({ created: 2, updated: 1 })
  })

  it('lets the later row win, keeping the earlier row slot', async () => {
    await saveImportedFoods(USER, [usda('111', 'Oats'), usda('111', 'Rolled oats')])
    expect(foods).toHaveLength(1)
    expect(foods[0]!.name).toBe('Rolled oats')
  })

  it('still creates distinct foods normally', async () => {
    const res = await saveImportedFoods(USER, [usda('1', 'A'), usda('2', 'B')])
    expect(res).toEqual({ created: 2, updated: 0 })
    expect(foods).toHaveLength(2)
  })
})
