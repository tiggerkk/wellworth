import { describe, expect, it } from 'vitest'
// `?raw` inlines the file as a string (declared by vite/client); vitest resolves it at runtime,
// so the seed migration is cross-checked against the TS list without needing node fs types.
import SEED_SQL from '../../supabase/migrations/20260622121000_seed_medical_lab_test.sql?raw'
import {
  defaultTrackedTestKeys,
  formatRefRange,
  formatResultValue,
  isMedicalFieldVisible,
  labTestByKey,
  MEDICAL_CATEGORIES,
  MEDICAL_LAB_TESTS,
  medicalTestsByCategory,
  orderResultsForDisplay,
  VALUE_KINDS,
} from './medical'

/** First quoted token on each `('key', ...` VALUES row = the test key (skips comments/header). */
function seedKeys(): string[] {
  return [...SEED_SQL.matchAll(/^\s*\('([a-z0-9_]+)',/gm)].map((m) => m[1]!)
}

describe('MEDICAL_LAB_TESTS reference list', () => {
  it('uses only valid categories', () => {
    const valid = new Set<string>(MEDICAL_CATEGORIES)
    for (const t of MEDICAL_LAB_TESTS) expect(valid.has(t.category)).toBe(true)
  })

  it('uses only valid value kinds', () => {
    const valid = new Set<string>(VALUE_KINDS)
    for (const t of MEDICAL_LAB_TESTS) expect(valid.has(t.value_kind)).toBe(true)
  })

  it('has unique keys', () => {
    const keys = MEDICAL_LAB_TESTS.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has a unique sort_order within each category', () => {
    for (const category of MEDICAL_CATEGORIES) {
      const orders = MEDICAL_LAB_TESTS.filter((t) => t.category === category).map(
        (t) => t.sort_order,
      )
      expect(new Set(orders).size).toBe(orders.length)
    }
  })

  it('includes the six eye refraction keys', () => {
    const keys = new Set(MEDICAL_LAB_TESTS.map((t) => t.key))
    for (const k of [
      'sphere_od',
      'cylinder_od',
      'addition_od',
      'sphere_os',
      'cylinder_os',
      'addition_os',
    ]) {
      expect(keys.has(k)).toBe(true)
    }
  })

  it('has a non-empty default-tracked starter set, all valid keys', () => {
    const tracked = defaultTrackedTestKeys()
    const keys = new Set(MEDICAL_LAB_TESTS.map((t) => t.key))
    expect(tracked.length).toBeGreaterThan(0)
    for (const k of tracked) expect(keys.has(k)).toBe(true)
  })
})

describe('seed migration mirrors the reference list (no drift)', () => {
  it('seeds exactly the same set of keys as MEDICAL_LAB_TESTS', () => {
    const tsKeys = [...MEDICAL_LAB_TESTS.map((t) => t.key)].sort()
    const sqlKeys = [...seedKeys()].sort()
    expect(sqlKeys).toEqual(tsKeys)
  })
})

describe('labTestByKey / medicalTestsByCategory', () => {
  it('maps every seeded key', () => {
    expect(labTestByKey.size).toBe(MEDICAL_LAB_TESTS.length)
    expect(labTestByKey.get('ldl_cholesterol')?.display_name).toBe('LDL Cholesterol')
  })

  it('groups in section order, no empty groups, covering every test', () => {
    const groups = medicalTestsByCategory()
    const order = groups.map((g) => g.category)
    // groups appear in MEDICAL_CATEGORIES order
    expect(order).toEqual([...MEDICAL_CATEGORIES].filter((c) => order.includes(c)))
    expect(groups.every((g) => g.tests.length > 0)).toBe(true)
    expect(groups.reduce((n, g) => n + g.tests.length, 0)).toBe(MEDICAL_LAB_TESTS.length)
    // each group is sorted by sort_order
    for (const g of groups) {
      const orders = g.tests.map((t) => t.sort_order)
      expect(orders).toEqual([...orders].sort((a, b) => a - b))
    }
  })
})

describe('orderResultsForDisplay', () => {
  const row = (
    test_key: string | null,
    category: string,
    test_name = test_key ?? 'x',
  ) => ({
    test_key,
    category,
    test_name,
  })

  it('orders by category section then seeded sort_order; ad-hoc last in its category', () => {
    const input = [
      row('hdl_cholesterol', 'lipids'), // lipids sort 30
      row('creatinine', 'renal'), // renal sort 10
      row(null, 'lipids', 'Custom Lipid'), // ad-hoc → last in lipids
      row('total_cholesterol', 'lipids'), // lipids sort 10
    ]
    const out = orderResultsForDisplay(input).map((r) => r.test_name)
    expect(out).toEqual([
      'total_cholesterol',
      'hdl_cholesterol',
      'Custom Lipid',
      'creatinine',
    ])
  })

  it('honours section + test order overrides', () => {
    const input = [row('creatinine', 'renal'), row('total_cholesterol', 'lipids')]
    const out = orderResultsForDisplay(
      input,
      ['renal', 'lipids'],
      ['creatinine', 'total_cholesterol'],
    ).map((r) => r.test_name)
    expect(out).toEqual(['creatinine', 'total_cholesterol'])
  })

  it('does not mutate the input array', () => {
    const input = [row('hdl_cholesterol', 'lipids'), row('creatinine', 'renal')]
    const copy = [...input]
    orderResultsForDisplay(input)
    expect(input).toEqual(copy)
  })
})

describe('isMedicalFieldVisible', () => {
  it('treats NULL as all visible', () => {
    expect(isMedicalFieldVisible(null, 'provider')).toBe(true)
    expect(isMedicalFieldVisible(undefined, 'narrative')).toBe(true)
  })
  it('honours an explicit list', () => {
    expect(isMedicalFieldVisible(['provider'], 'provider')).toBe(true)
    expect(isMedicalFieldVisible(['provider'], 'narrative')).toBe(false)
  })
})

describe('formatResultValue / formatRefRange', () => {
  it('prefers text, then number, else dash', () => {
    expect(formatResultValue({ value_text: 'Negative', value_num: null })).toBe(
      'Negative',
    )
    expect(formatResultValue({ value_text: null, value_num: 2.9 })).toBe('2.9')
    expect(formatResultValue({ value_text: '  ', value_num: null })).toBe('—')
  })
  it('prefers printed ref text, else the numeric span / one-sided', () => {
    expect(formatRefRange({ ref_text: '3.5-7.2', ref_low: 3.5, ref_high: 7.2 })).toBe(
      '3.5-7.2',
    )
    expect(formatRefRange({ ref_text: null, ref_low: 3.5, ref_high: 7.2 })).toBe(
      '3.5–7.2',
    )
    expect(formatRefRange({ ref_text: null, ref_low: 10, ref_high: null })).toBe('≥ 10')
    expect(formatRefRange({ ref_text: null, ref_low: null, ref_high: null })).toBe('')
  })
})
