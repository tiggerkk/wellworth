import { describe, expect, it } from 'vitest'
import {
  buildDiaryEntryInsert,
  buildStrengthSetInserts,
  matchByName,
  parseDiaryJsonText,
  validateDiaryData,
  type ParsedDiaryActivityEntry,
  type ParsedDiaryFoodEntry,
} from './wellness-diary-import'

describe('parseDiaryJsonText', () => {
  it('parses valid JSON', () => {
    const result = parseDiaryJsonText('[{"day":"2026-01-15","entries":[]}]')
    expect(result.ok).toBe(true)
  })

  it('reports a clean error for invalid JSON', () => {
    const result = parseDiaryJsonText('{not valid json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Couldn’t parse the JSON')
  })
})

describe('validateDiaryData', () => {
  it('rejects a non-array top level', () => {
    const result = validateDiaryData({ day: '2026-01-15' })
    expect(result.days).toEqual([])
    expect(result.errors).toHaveLength(1)
  })

  it('parses a day with a food entry', () => {
    const result = validateDiaryData([
      {
        day: '2026-01-15',
        entries: [
          {
            group: 'breakfast',
            label: 'Yogurt',
            amount: 1,
            energy_kcal: 150,
            nutrients: { protein: 10 },
          },
        ],
      },
    ])
    expect(result.errors).toEqual([])
    expect(result.days).toHaveLength(1)
    const entry = result.days[0]?.entries[0]
    expect(entry?.kind).toBe('food')
    expect(entry).toMatchObject({
      group: 'breakfast',
      label: 'Yogurt',
      amount: 1,
      energy_kcal: 150,
    })
  })

  it('parses a day with an activity entry including exercises', () => {
    const result = validateDiaryData([
      {
        day: '2026-01-15',
        entries: [
          {
            group: 'activities',
            label: 'Strength Training',
            duration_min: 45,
            effort: 'vigorous',
            energy_kcal: -280,
            exercises: [{ name: 'Bench Press', sets: [{ reps: 8, weight: 60 }] }],
          },
        ],
      },
    ])
    expect(result.errors).toEqual([])
    const entry = result.days[0]?.entries[0] as ParsedDiaryActivityEntry
    expect(entry.kind).toBe('activity')
    expect(entry.duration_min).toBe(45)
    expect(entry.effort).toBe('vigorous')
    expect(entry.exercises).toEqual([
      { name: 'Bench Press', sets: [{ reps: 8, weight: 60, weight_unit: 'kg' }] },
    ])
  })

  it('defaults sort_order to array position when omitted', () => {
    const result = validateDiaryData([
      {
        day: '2026-01-15',
        entries: [
          { group: 'breakfast', label: 'A', energy_kcal: 1 },
          { group: 'lunch', label: 'B', energy_kcal: 2 },
        ],
      },
    ])
    expect(result.days[0]?.entries.map((e) => e.sort_order)).toEqual([0, 1])
  })

  it('uses an explicit sort_order when given', () => {
    const result = validateDiaryData([
      {
        day: '2026-01-15',
        entries: [{ group: 'breakfast', label: 'A', energy_kcal: 1, sort_order: 7 }],
      },
    ])
    expect(result.days[0]?.entries[0]?.sort_order).toBe(7)
  })

  it('flags and skips a row with an unrecognized group', () => {
    const result = validateDiaryData([
      { day: '2026-01-15', entries: [{ group: 'brunch', label: 'A', energy_kcal: 1 }] },
    ])
    expect(result.days[0]?.entries).toEqual([])
    expect(result.errors[0]).toContain('unrecognized group')
  })

  it('flags and skips a row with a missing label', () => {
    const result = validateDiaryData([
      { day: '2026-01-15', entries: [{ group: 'breakfast', label: '', energy_kcal: 1 }] },
    ])
    expect(result.days[0]?.entries).toEqual([])
    expect(result.errors[0]).toContain('missing label')
  })

  it('rejects an invalid day and skips that item', () => {
    const result = validateDiaryData([{ day: 'not-a-date', entries: [] }])
    expect(result.days).toEqual([])
    expect(result.errors[0]).toContain('must be a date')
  })

  it('flags a day repeated at the top level and keeps only the first', () => {
    const result = validateDiaryData([
      {
        day: '2026-01-15',
        entries: [{ group: 'breakfast', label: 'First', energy_kcal: 1 }],
      },
      {
        day: '2026-01-15',
        entries: [{ group: 'lunch', label: 'Second', energy_kcal: 2 }],
      },
    ])
    expect(result.days).toHaveLength(1)
    expect(result.days[0]?.entries[0]?.label).toBe('First')
    expect(result.errors.some((e) => e.includes('more than once'))).toBe(true)
  })

  it('defaults an unrecognized effort to null rather than rejecting the row', () => {
    const result = validateDiaryData([
      {
        day: '2026-01-15',
        entries: [
          { group: 'activities', label: 'Run', energy_kcal: -100, effort: 'extreme' },
        ],
      },
    ])
    const entry = result.days[0]?.entries[0] as ParsedDiaryActivityEntry
    expect(entry.effort).toBeNull()
  })

  it('skips an exercise missing a name but keeps the entry', () => {
    const result = validateDiaryData([
      {
        day: '2026-01-15',
        entries: [
          {
            group: 'activities',
            label: 'Workout',
            energy_kcal: -50,
            exercises: [{ sets: [{ reps: 5, weight: 20 }] }],
          },
        ],
      },
    ])
    const entry = result.days[0]?.entries[0] as ParsedDiaryActivityEntry
    expect(entry.exercises).toEqual([])
    expect(result.errors.some((e) => e.includes('missing a name'))).toBe(true)
  })
})

describe('buildDiaryEntryInsert', () => {
  const foodEntry: ParsedDiaryFoodEntry = {
    kind: 'food',
    group: 'breakfast',
    sort_order: 0,
    label: 'Yogurt',
    amount: 1.5,
    energy_kcal: 220,
    nutrients: { protein: 18 },
  }

  const activityEntry: ParsedDiaryActivityEntry = {
    kind: 'activity',
    group: 'activities',
    sort_order: 1,
    label: 'Strength Training',
    duration_min: 45,
    effort: 'vigorous',
    energy_kcal: -280,
    exercises: [],
  }

  it('builds a food insert with food_id set and activity fields null', () => {
    const insert = buildDiaryEntryInsert('2026-01-15', foodEntry, 'food-1', null)
    expect(insert).toMatchObject({
      day: '2026-01-15',
      kind: 'food',
      food_id: 'food-1',
      activity_id: null,
      amount: 1.5,
      duration_min: null,
      effort: null,
      nutrients: { protein: 18 },
    })
  })

  it('builds an activity insert with activity_id set and food fields null', () => {
    const insert = buildDiaryEntryInsert('2026-01-15', activityEntry, null, 'act-1')
    expect(insert).toMatchObject({
      day: '2026-01-15',
      kind: 'activity',
      food_id: null,
      activity_id: 'act-1',
      amount: null,
      duration_min: 45,
      effort: 'vigorous',
      nutrients: {},
    })
  })

  it('leaves food_id/activity_id null when no match was found', () => {
    const insert = buildDiaryEntryInsert('2026-01-15', foodEntry, null, null)
    expect(insert.food_id).toBeNull()
  })
})

describe('buildStrengthSetInserts', () => {
  it('flattens exercises into one row per set, numbering set_number from 1 per exercise', () => {
    const rows = buildStrengthSetInserts('entry-1', [
      {
        name: 'Bench Press',
        sets: [
          { reps: 8, weight: 60, weight_unit: 'kg' },
          { reps: 6, weight: 65, weight_unit: 'kg' },
        ],
      },
      { name: 'Squat', sets: [{ reps: 5, weight: 100, weight_unit: 'kg' }] },
    ])
    expect(rows).toEqual([
      {
        entry_id: 'entry-1',
        exercise: 'Bench Press',
        set_number: 1,
        reps: 8,
        weight: 60,
        weight_unit: 'kg',
      },
      {
        entry_id: 'entry-1',
        exercise: 'Bench Press',
        set_number: 2,
        reps: 6,
        weight: 65,
        weight_unit: 'kg',
      },
      {
        entry_id: 'entry-1',
        exercise: 'Squat',
        set_number: 1,
        reps: 5,
        weight: 100,
        weight_unit: 'kg',
      },
    ])
  })

  it('produces no rows for no exercises', () => {
    expect(buildStrengthSetInserts('entry-1', [])).toEqual([])
  })
})

describe('matchByName', () => {
  it('matches case-insensitively via normMatch', () => {
    const map = new Map([['greekyogurt', 'food-1']])
    expect(matchByName('Greek Yogurt', map)).toBe('food-1')
  })

  it('returns null on no match', () => {
    expect(matchByName('Unknown Food', new Map())).toBeNull()
  })
})
