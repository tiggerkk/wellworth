import { describe, expect, it } from 'vitest'
import { aggregateEntries, averageNutrients, perDay } from './medical-report'
import type { Tables } from '../types/database'

// Minimal factory — aggregateEntries only reads day/kind/energy_kcal/nutrients.
function entry(p: Partial<Tables<'diary_entry'>>): Tables<'diary_entry'> {
  return {
    day: '2026-06-13',
    kind: 'food',
    energy_kcal: 0,
    nutrients: {},
    ...p,
  } as Tables<'diary_entry'>
}

describe('aggregateEntries', () => {
  it('counts distinct logged days, splits consumed vs activity, sums nutrients', () => {
    const agg = aggregateEntries([
      entry({
        day: '2026-06-13',
        kind: 'food',
        energy_kcal: 400,
        nutrients: { protein: 20 },
      }),
      entry({
        day: '2026-06-13',
        kind: 'food',
        energy_kcal: 300,
        nutrients: { protein: 10 },
      }),
      entry({ day: '2026-06-12', kind: 'activity', energy_kcal: -250, nutrients: {} }),
    ])
    expect(agg.loggedDays).toBe(2)
    expect(agg.consumedKcal).toBe(700)
    expect(agg.activityKcal).toBe(250) // magnitude of the negative activity entry
    expect(agg.totals.protein).toBe(30)
  })

  it('derives net carbs in the totals', () => {
    const agg = aggregateEntries([entry({ nutrients: { carbs: 50, fiber: 12 } })])
    expect(agg.totals.net_carbs).toBe(38)
  })
})

describe('perDay / averageNutrients', () => {
  it('divides by logged days', () => {
    expect(perDay(700, 2)).toBe(350)
    expect(perDay(700, 0)).toBe(0)
    expect(averageNutrients({ protein: 30 }, 2)).toEqual({ protein: 15 })
    expect(averageNutrients({ protein: 30 }, 0)).toEqual({})
  })
})
