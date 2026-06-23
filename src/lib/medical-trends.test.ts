import { describe, expect, it } from 'vitest'
import {
  buildTrendSeries,
  latestByCategory,
  latestPoint,
  latestResultPerTest,
  trackedSeries,
  type TrendInputResult,
} from './medical-trends'

/** Terse builder for a trend-input result row (only the fields the helpers read). */
function r(over: Partial<TrendInputResult>): TrendInputResult {
  return {
    test_key: null,
    test_name: 'Test',
    category: 'other',
    value_num: null,
    value_text: null,
    unit: null,
    ref_low: null,
    ref_high: null,
    ref_text: null,
    flag: null,
    report_id: 'rep',
    report_date: '2025-01-01',
    ...over,
  }
}

describe('buildTrendSeries', () => {
  const rows = [
    r({
      test_key: 'ldl_cholesterol',
      value_num: 3.1,
      report_date: '2024-05-01',
      report_id: 'a',
      flag: 'high',
    }),
    r({
      test_key: 'ldl_cholesterol',
      value_num: 2.9,
      report_date: '2026-05-01',
      report_id: 'c',
    }),
    r({
      test_key: 'ldl_cholesterol',
      value_num: 3.0,
      report_date: '2025-05-01',
      report_id: 'b',
    }),
    r({
      test_key: 'hdl_cholesterol',
      value_num: 1.6,
      report_date: '2025-05-01',
      report_id: 'b',
    }),
  ]

  it('returns only the requested test, sorted by date ascending', () => {
    const series = buildTrendSeries(rows, 'ldl_cholesterol')
    expect(series.map((p) => p.date)).toEqual(['2024-05-01', '2025-05-01', '2026-05-01'])
    expect(series.map((p) => p.value)).toEqual([3.1, 3.0, 2.9])
  })

  it('carries the printed flag, narrowing unknown flags to null', () => {
    const series = buildTrendSeries(
      [
        r({ test_key: 'x', value_num: 1, flag: 'high', report_date: '2025-01-01' }),
        r({ test_key: 'x', value_num: 2, flag: 'bogus', report_date: '2025-02-01' }),
      ],
      'x',
    )
    expect(series.map((p) => p.flag)).toEqual(['high', null])
  })

  it('skips rows without a numeric value (qualitative-only → empty series)', () => {
    const series = buildTrendSeries(
      [
        r({ test_key: 'abo_grouping', value_text: 'O+', report_date: '2025-01-01' }),
        r({ test_key: 'abo_grouping', value_num: null, report_date: '2026-01-01' }),
      ],
      'abo_grouping',
    )
    expect(series).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [
      r({ test_key: 'x', value_num: 2, report_date: '2026-01-01' }),
      r({ test_key: 'x', value_num: 1, report_date: '2025-01-01' }),
    ]
    const before = input.map((x) => x.report_date)
    buildTrendSeries(input, 'x')
    expect(input.map((x) => x.report_date)).toEqual(before)
  })
})

describe('latestResultPerTest', () => {
  it('keeps the most recent row per test key', () => {
    const latest = latestResultPerTest([
      r({ test_key: 'creatinine', value_num: 80, report_date: '2024-05-01' }),
      r({ test_key: 'creatinine', value_num: 78, report_date: '2026-05-01' }),
      r({ test_key: 'urea', value_num: 5, report_date: '2025-05-01' }),
    ])
    const byKey = new Map(latest.map((x) => [x.test_key, x.value_num]))
    expect(byKey.get('creatinine')).toBe(78)
    expect(byKey.get('urea')).toBe(5)
    expect(latest).toHaveLength(2)
  })

  it('groups ad-hoc rows (no key) by normalized name', () => {
    const latest = latestResultPerTest([
      r({
        test_key: null,
        test_name: ' Custom Marker ',
        value_num: 1,
        report_date: '2024-01-01',
      }),
      r({
        test_key: null,
        test_name: 'custom marker',
        value_num: 2,
        report_date: '2026-01-01',
      }),
    ])
    expect(latest).toHaveLength(1)
    expect(latest[0]!.value_num).toBe(2)
  })

  it('includes qualitative latest values', () => {
    const latest = latestResultPerTest([
      r({ test_key: 'hbsag', value_text: 'Negative', report_date: '2025-01-01' }),
    ])
    expect(latest[0]!.value_text).toBe('Negative')
  })
})

describe('trackedSeries', () => {
  it('returns only tracked tests that have numeric data, in canonical section order', () => {
    const rows = [
      // creatinine is renal (later category), ldl is lipids (earlier) — output should reorder.
      r({ test_key: 'creatinine', value_num: 78, report_date: '2025-05-01' }),
      r({ test_key: 'ldl_cholesterol', value_num: 2.9, report_date: '2025-05-01' }),
    ]
    const tracked = trackedSeries(rows, ['creatinine', 'ldl_cholesterol', 'hba1c'])
    // hba1c is tracked but has no data → dropped; lipids sorts before renal.
    expect(tracked.map((t) => t.key)).toEqual(['ldl_cholesterol', 'creatinine'])
    expect(tracked[0]!.unit).toBe('mmol/L')
    expect(tracked[0]!.name).toBe('LDL Cholesterol')
  })

  it('ignores unknown tracked keys', () => {
    const tracked = trackedSeries(
      [r({ test_key: 'not_a_real_key', value_num: 1, report_date: '2025-01-01' })],
      ['not_a_real_key'],
    )
    expect(tracked).toEqual([])
  })
})

describe('latestByCategory', () => {
  it('groups the latest value per test under category headers in section order', () => {
    const groups = latestByCategory([
      r({
        test_key: 'creatinine',
        category: 'renal',
        value_num: 80,
        report_date: '2024-05-01',
      }),
      r({
        test_key: 'creatinine',
        category: 'renal',
        value_num: 78,
        report_date: '2026-05-01',
      }),
      r({
        test_key: 'ldl_cholesterol',
        category: 'lipids',
        value_num: 2.9,
        report_date: '2025-05-01',
      }),
    ])
    expect(groups.map((g) => g.category)).toEqual(['lipids', 'renal'])
    // only the latest creatinine survives
    expect(groups[1]!.rows).toHaveLength(1)
    expect(groups[1]!.rows[0]!.value_num).toBe(78)
  })
})

describe('latestPoint', () => {
  it('returns the last (most recent) point of a sorted series', () => {
    const series = buildTrendSeries(
      [
        r({ test_key: 'x', value_num: 1, report_date: '2025-01-01' }),
        r({ test_key: 'x', value_num: 9, report_date: '2026-01-01' }),
      ],
      'x',
    )
    expect(latestPoint(series)?.value).toBe(9)
  })

  it('returns undefined for an empty series', () => {
    expect(latestPoint([])).toBeUndefined()
  })
})
