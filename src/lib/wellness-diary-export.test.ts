import { describe, expect, it } from 'vitest'
import { buildDiaryExportData } from './wellness-diary-export'
import type { Tables } from '../types/database'

type DiaryEntryRow = Tables<'diary_entry'>
type StrengthSetRow = Tables<'strength_set'>

function makeFoodEntry(overrides: Partial<DiaryEntryRow> = {}): DiaryEntryRow {
  return {
    id: 'e1',
    user_id: 'u1',
    day: '2026-01-15',
    group_name: 'breakfast',
    kind: 'food',
    food_id: 'f1',
    activity_id: null,
    serving_id: null,
    amount: 1.5,
    duration_min: null,
    effort: null,
    energy_kcal: 220,
    label: 'Greek Yogurt',
    nutrients: { energy: 220, protein: 18 },
    sort_order: 0,
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-01-15T08:00:00Z',
    ...overrides,
  }
}

function makeActivityEntry(overrides: Partial<DiaryEntryRow> = {}): DiaryEntryRow {
  return {
    id: 'e2',
    user_id: 'u1',
    day: '2026-01-15',
    group_name: 'activities',
    kind: 'activity',
    food_id: null,
    activity_id: 'a1',
    serving_id: null,
    amount: null,
    duration_min: 45,
    effort: 'vigorous',
    energy_kcal: -280,
    label: 'Strength Training',
    nutrients: {},
    sort_order: 1785597823426,
    created_at: '2026-01-15T18:00:00Z',
    updated_at: '2026-01-15T18:00:00Z',
    ...overrides,
  }
}

function makeSet(overrides: Partial<StrengthSetRow> = {}): StrengthSetRow {
  return {
    id: 's1',
    entry_id: 'e2',
    exercise: 'Bench Press',
    exercise_order: 0, // add this
    set_number: 1,
    reps: 8,
    weight: 60,
    weight_unit: 'kg',
    ...overrides,
  }
}

describe('buildDiaryExportData', () => {
  it('groups entries under one object per day', () => {
    const days = buildDiaryExportData(
      [
        makeFoodEntry({ id: 'e1', day: '2026-01-15' }),
        makeFoodEntry({ id: 'e2', day: '2026-01-16' }),
      ],
      [],
    )
    expect(days.map((d) => d.day)).toEqual(['2026-01-15', '2026-01-16'])
    expect(days[0]?.entries).toHaveLength(1)
    expect(days[1]?.entries).toHaveLength(1)
  })

  it('sorts days ascending regardless of input order', () => {
    const days = buildDiaryExportData(
      [
        makeFoodEntry({ id: 'e1', day: '2026-03-01' }),
        makeFoodEntry({ id: 'e2', day: '2026-01-01' }),
        makeFoodEntry({ id: 'e3', day: '2026-02-01' }),
      ],
      [],
    )
    expect(days.map((d) => d.day)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
  })

  it('sorts entries within a day by sort_order ascending', () => {
    const days = buildDiaryExportData(
      [
        makeFoodEntry({ id: 'e1', label: 'Second', sort_order: 5 }),
        makeFoodEntry({ id: 'e2', label: 'First', sort_order: 1 }),
      ],
      [],
    )
    expect(days[0]?.entries.map((e) => e.label)).toEqual(['First', 'Second'])
  })

  it('re-numbers sort_order to 0-based position within the day, not the raw DB value', () => {
    const days = buildDiaryExportData(
      [
        makeFoodEntry({ id: 'e1', sort_order: 1785597823426 }),
        makeFoodEntry({ id: 'e2', sort_order: 1785597865221 }),
      ],
      [],
    )
    expect(days[0]?.entries.map((e) => e.sort_order)).toEqual([0, 1])
  })

  it('emits amount/nutrients for a food entry and omits activity-only fields', () => {
    const days = buildDiaryExportData(
      [makeFoodEntry({ amount: 2, nutrients: { protein: 10 } })],
      [],
    )
    const entry = days[0]?.entries[0]
    expect(entry).toMatchObject({
      group: 'breakfast',
      label: 'Greek Yogurt',
      amount: 2,
      nutrients: { protein: 10 },
    })
    expect(entry).not.toHaveProperty('duration_min')
    expect(entry).not.toHaveProperty('effort')
    expect(entry).not.toHaveProperty('exercises')
  })

  it('emits duration_min/effort for an activity entry and omits food-only fields', () => {
    const days = buildDiaryExportData([makeActivityEntry()], [])
    const entry = days[0]?.entries[0]
    expect(entry).toMatchObject({
      group: 'activities',
      label: 'Strength Training',
      duration_min: 45,
      effort: 'vigorous',
    })
    expect(entry).not.toHaveProperty('amount')
    expect(entry).not.toHaveProperty('nutrients')
  })

  it('omits exercises entirely for an activity entry with no strength sets', () => {
    const days = buildDiaryExportData([makeActivityEntry()], [])
    expect(days[0]?.entries[0]).not.toHaveProperty('exercises')
  })

  it('groups an activity entry’s strength sets into one exercises block per exercise name', () => {
    const sets = [
      makeSet({ exercise: 'Bench Press', set_number: 1, reps: 8, weight: 60 }),
      makeSet({ exercise: 'Bench Press', set_number: 2, reps: 6, weight: 65 }),
      makeSet({ exercise: 'Squat', set_number: 1, reps: 5, weight: 100 }),
    ]
    const days = buildDiaryExportData([makeActivityEntry({ id: 'e2' })], sets)
    expect(days[0]?.entries[0]?.exercises).toEqual([
      {
        name: 'Bench Press',
        sets: [
          { reps: 8, weight: 60, weight_unit: 'kg' },
          { reps: 6, weight: 65, weight_unit: 'kg' },
        ],
      },
      { name: 'Squat', sets: [{ reps: 5, weight: 100, weight_unit: 'kg' }] },
    ])
  })

  it('produces an empty array for no entries', () => {
    expect(buildDiaryExportData([], [])).toEqual([])
  })
})
