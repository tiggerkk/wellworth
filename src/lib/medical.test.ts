import { describe, expect, it } from 'vitest'
// `?raw` inlines the file as a string (declared by vite/client); vitest resolves it at runtime,
// so the seed migration is cross-checked against the TS list without needing node fs types.
import SEED_SQL from '../../supabase/migrations/11_medical_seed_lab_test.sql?raw'
import {
  applyReportView,
  DEFAULT_REPORT_LIST_CRITERIA,
  defaultTrackedTestKeys,
  EYE_REFRACTION_KEYS,
  EYE_REFRACTION_ROWS,
  formatRefRange,
  formatResultValue,
  isMedicalFieldVisible,
  labTestByKey,
  MEDICAL_CATEGORIES,
  MEDICAL_LAB_TESTS,
  medicalTestsByCategory,
  orderResultsForDisplay,
  reportBodyParts,
  reportProviders,
  VALUE_KINDS,
  type MedicalReportRow,
  type ReportListCriteria,
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

describe('EYE_REFRACTION constants (M7 form grid)', () => {
  it('lists six keys that are all real numeric eye-category tests', () => {
    expect(EYE_REFRACTION_KEYS).toHaveLength(6)
    for (const key of EYE_REFRACTION_KEYS) {
      const seed = labTestByKey.get(key)
      expect(seed).toBeDefined()
      expect(seed!.category).toBe('eye')
      expect(seed!.value_kind).toBe('numeric')
    }
  })

  it('the grid rows flatten to exactly the key set (3 columns per eye)', () => {
    expect(EYE_REFRACTION_ROWS.flatMap((r) => r.keys)).toEqual(EYE_REFRACTION_KEYS)
    for (const row of EYE_REFRACTION_ROWS) expect(row.keys).toHaveLength(3)
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

describe('applyReportView (Reports search / filter / sort)', () => {
  function makeReport(
    over: Partial<MedicalReportRow> & { id: string },
  ): MedicalReportRow {
    return {
      user_id: 'u',
      report_date: '2026-01-01',
      report_type: 'health_screening',
      provider: null,
      body_part: null,
      narrative: null,
      document_urls: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      ...over,
    }
  }

  const reports: MedicalReportRow[] = [
    makeReport({
      id: 'a',
      report_date: '2026-03-01',
      report_type: 'mri',
      provider: 'Acme Imaging',
      body_part: 'Brain',
      narrative: 'No acute findings.',
    }),
    makeReport({
      id: 'b',
      report_date: '2026-01-15',
      report_type: 'ultrasound',
      provider: 'Bay Clinic',
      body_part: 'Liver',
      narrative: 'Mild steatosis noted.',
    }),
    makeReport({
      id: 'c',
      report_date: '2026-02-10',
      report_type: 'health_screening',
      provider: 'Acme Imaging',
      body_part: null,
    }),
  ]

  const crit = (over: Partial<ReportListCriteria> = {}): ReportListCriteria => ({
    ...DEFAULT_REPORT_LIST_CRITERIA,
    ...over,
  })

  it('sorts newest report first by default', () => {
    expect(applyReportView(reports, crit()).map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })

  it('searches body part + narrative', () => {
    expect(applyReportView(reports, crit({ query: 'liver' })).map((r) => r.id)).toEqual([
      'b',
    ])
    expect(
      applyReportView(reports, crit({ query: 'steatosis' })).map((r) => r.id),
    ).toEqual(['b'])
  })

  it('matches Chinese body part / narrative across Traditional/Simplified variants', () => {
    const simp = makeReport({ id: 'zh', body_part: '肝脏' }) // Simplified
    expect(applyReportView([simp], crit({ query: '肝臟' }))).toEqual([simp]) // Traditional query
    const trad = makeReport({ id: 'zh-t', narrative: '腦部無異常' }) // Traditional
    expect(applyReportView([trad], crit({ query: '脑部' }))).toEqual([trad]) // Simplified query
  })

  it('filters by type, provider, and body part', () => {
    expect(
      applyReportView(reports, crit({ reportType: 'mri' })).map((r) => r.id),
    ).toEqual(['a'])
    expect(
      applyReportView(reports, crit({ provider: 'Acme Imaging' })).map((r) => r.id),
    ).toEqual(['a', 'c'])
    expect(
      applyReportView(reports, crit({ bodyPart: 'Liver' })).map((r) => r.id),
    ).toEqual(['b'])
  })

  it('sorts by provider ascending, newest-first within ties', () => {
    expect(
      applyReportView(reports, crit({ sortField: 'provider', sortDir: 'asc' })).map(
        (r) => r.id,
      ),
    ).toEqual(['a', 'c', 'b'])
  })

  it('derives distinct sorted providers and body parts', () => {
    expect(reportProviders(reports)).toEqual(['Acme Imaging', 'Bay Clinic'])
    expect(reportBodyParts(reports)).toEqual(['Brain', 'Liver'])
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
