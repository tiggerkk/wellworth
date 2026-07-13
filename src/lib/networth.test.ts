import { describe, expect, it } from 'vitest'
import { ASSET_TYPES } from '../constants/networth'
import {
  ageForYear,
  breakEven,
  foldMonthlyTotals,
  formatHkd,
  formatHkdCompact,
  groupByType,
  insuranceRowDetails,
  originalCashValueAtAge,
  resolvePolicyAtAge,
  type ScheduleVersion,
  sumTotals,
  surrenderGainPctPerYear,
  totalBase,
  typeBreakdown,
  typeBreakdownFromTotals,
  typeTotals,
  valueBase,
  varianceAtAge,
} from './networth'

describe('valueBase', () => {
  it('multiplies native value by the rate', () => {
    expect(valueBase(100, 1.08)).toBeCloseTo(108)
  })
  it('is identity for an HKD rate of 1', () => {
    expect(valueBase(500000, 1)).toBe(500000)
  })
})

describe('totalBase', () => {
  it('sums value_base across entries', () => {
    expect(
      totalBase([{ value_base: 100 }, { value_base: 50.5 }, { value_base: 0 }]),
    ).toBe(150.5)
  })
  it('is 0 for no entries', () => {
    expect(totalBase([])).toBe(0)
  })
})

describe('groupByType', () => {
  it('returns all 7 asset types in fixed order, partitioning entries', () => {
    const entries = [
      { asset_type: 'stock', id: 'a' },
      { asset_type: 'cash', id: 'b' },
      { asset_type: 'stock', id: 'c' },
    ]
    const groups = groupByType(entries)
    expect(groups.map((g) => g.type)).toEqual([...ASSET_TYPES])
    expect(groups.find((g) => g.type === 'stock')?.entries.map((e) => e.id)).toEqual([
      'a',
      'c',
    ])
    expect(groups.find((g) => g.type === 'cash')?.entries).toHaveLength(1)
    expect(groups.find((g) => g.type === 'property')?.entries).toHaveLength(0)
  })
})

describe('formatHkd', () => {
  it('rounds and adds thousands separators', () => {
    expect(formatHkd(1234567.8)).toBe('HK$1,234,568')
    expect(formatHkd(0)).toBe('HK$0')
  })
})

describe('formatHkdCompact', () => {
  it('abbreviates millions and thousands', () => {
    expect(formatHkdCompact(1_234_567)).toBe('HK$1.2M')
    expect(formatHkdCompact(15_000_000)).toBe('HK$15M')
    expect(formatHkdCompact(450_000)).toBe('HK$450K')
    expect(formatHkdCompact(900)).toBe('HK$900')
  })
})

describe('typeTotals', () => {
  it('sums value_base per type with all 7 keys present', () => {
    const totals = typeTotals([
      { asset_type: 'cash', value_base: 100 },
      { asset_type: 'cash', value_base: 50 },
      { asset_type: 'stock', value_base: 200 },
    ])
    expect(totals.cash).toBe(150)
    expect(totals.stock).toBe(200)
    expect(totals.property).toBe(0)
    expect(Object.keys(totals)).toHaveLength(7)
  })
})

describe('typeBreakdown', () => {
  it('returns per-type totals and share of the grand total', () => {
    const rows = typeBreakdown([
      { asset_type: 'cash', value_base: 250 },
      { asset_type: 'stock', value_base: 750 },
    ])
    expect(rows.map((r) => r.type)).toEqual([...ASSET_TYPES])
    expect(rows.find((r) => r.type === 'cash')).toMatchObject({ total: 250, pct: 0.25 })
    expect(rows.find((r) => r.type === 'stock')?.pct).toBeCloseTo(0.75)
    expect(rows.reduce((s, r) => s + r.pct, 0)).toBeCloseTo(1)
  })
  it('uses pct 0 when there is no value', () => {
    expect(typeBreakdown([]).every((r) => r.pct === 0 && r.total === 0)).toBe(true)
  })
})

describe('typeBreakdownFromTotals', () => {
  it('matches typeBreakdown for the equivalent totals record', () => {
    const totals = typeTotals([
      { asset_type: 'cash', value_base: 250 },
      { asset_type: 'stock', value_base: 750 },
    ])
    expect(typeBreakdownFromTotals(totals)).toEqual(
      typeBreakdown([
        { asset_type: 'cash', value_base: 250 },
        { asset_type: 'stock', value_base: 750 },
      ]),
    )
  })
})

describe('sumTotals', () => {
  it('sums a totals record across all asset types', () => {
    const totals = typeTotals([
      { asset_type: 'cash', value_base: 100 },
      { asset_type: 'stock', value_base: 250 },
    ])
    expect(sumTotals(totals)).toBe(350)
  })
})

describe('foldMonthlyTotals', () => {
  it('folds flat per-(month, type) rows into one totals record per month, oldest first', () => {
    const folded = foldMonthlyTotals([
      { month: '2026-02-01', asset_type: 'stock', total_base: 300 },
      { month: '2026-01-01', asset_type: 'cash', total_base: 100 },
      { month: '2026-01-01', asset_type: 'stock', total_base: 200 },
    ])
    expect(folded.map((m) => m.month)).toEqual(['2026-01-01', '2026-02-01'])
    expect(folded[0]!.totals.cash).toBe(100)
    expect(folded[0]!.totals.stock).toBe(200)
    expect(folded[0]!.totals.property).toBe(0)
    expect(Object.keys(folded[0]!.totals)).toHaveLength(7)
    expect(sumTotals(folded[1]!.totals)).toBe(300)
  })

  it('is empty for no rows', () => {
    expect(foldMonthlyTotals([])).toEqual([])
  })
})

describe('insurance resolution', () => {
  const original: ScheduleVersion = {
    id: 'orig',
    kind: 'original',
    first_year: 45,
    effective_date: '2019-01-01',
    points: [
      { age: 45, policy_year: 5, total_premium_paid: 100, cash_value: 60 },
      { age: 46, policy_year: 6, total_premium_paid: 100, cash_value: 90 },
      { age: 47, policy_year: 7, total_premium_paid: 100, cash_value: 110 },
      // gap at 48
      { age: 49, policy_year: 9, total_premium_paid: 100, cash_value: 150 },
    ],
  }
  const update: ScheduleVersion = {
    id: 'upd',
    kind: 'update',
    first_year: 47,
    effective_date: '2021-06-01',
    points: [
      { age: 47, policy_year: 7, total_premium_paid: 100, cash_value: 130 },
      { age: 48, policy_year: 8, total_premium_paid: 100, cash_value: 145 },
    ],
  }

  it('ageForYear subtracts the birth year (default 1974)', () => {
    expect(ageForYear(2019)).toBe(45)
    expect(ageForYear(2026, 1974)).toBe(52)
  })

  it('uses the newest version whose first_year ≤ age', () => {
    // age 47 — both versions apply; the newer (update, effective 2021) wins.
    expect(resolvePolicyAtAge([original, update], 47)?.cashValue).toBe(130)
    // age 46 — only the original applies (update.first_year is 47).
    expect(resolvePolicyAtAge([original, update], 46)?.cashValue).toBe(90)
  })

  it('carries the nearest earlier real point and tags it', () => {
    // age 48: original has a gap; only original applies via carry... but update also applies at 48.
    const r = resolvePolicyAtAge([original, update], 48)
    expect(r).toMatchObject({ cashValue: 145, isCarried: false }) // update has a real point at 48
    // age 50: update's newest applies, nearest earlier point is 48 → carried.
    const carried = resolvePolicyAtAge([original, update], 50)
    expect(carried).toMatchObject({ cashValue: 145, isCarried: true, asOfYear: 8 })
  })

  it('returns null before the earliest first_year', () => {
    expect(resolvePolicyAtAge([original, update], 44)).toBeNull()
  })

  it('original baseline + variance use the original schedule only', () => {
    expect(originalCashValueAtAge([original, update], 47)).toBe(110)
    // variance at 47 = resolved (130, from update) − original (110) = 20
    expect(varianceAtAge([original, update], 47)).toBe(20)
  })

  it('break-even is the first age where cash ≥ premium', () => {
    // original alone: cash crosses 100 at age 47 (110 ≥ 100).
    expect(breakEven([original])).toEqual({ age: 47, atOrBeforeFirst: false })
  })

  it('flags break-even at/before the first tracked year', () => {
    const midLife: ScheduleVersion = {
      id: 'm',
      kind: 'original',
      first_year: 60,
      effective_date: '2020-01-01',
      points: [{ age: 60, policy_year: 20, total_premium_paid: 100, cash_value: 200 }],
    }
    expect(breakEven([midLife])).toEqual({ age: 60, atOrBeforeFirst: true })
  })

  it('surrenderGainPctPerYear matches the formula and guards divide-by-zero', () => {
    expect(surrenderGainPctPerYear(110, 100, 5)).toBeCloseTo(2)
    expect(surrenderGainPctPerYear(100, 0, 5)).toBe(0)
    expect(surrenderGainPctPerYear(100, 100, 0)).toBe(0)
  })

  it('insuranceRowDetails includes start_date and matches resolvePolicyAtAge — the single builder shared by the live Monthly Entry resolver and the manual-import freeze path', () => {
    const policy = {
      id: 'p1',
      policy_number: 'POL-001',
      provider: 'aia',
      start_date: '2014-03-01',
    }
    const resolved = resolvePolicyAtAge([original, update], 47)!
    const details = insuranceRowDetails(policy, resolved, 110, 20)
    expect(details).toMatchObject({
      policy_id: 'p1',
      policy_number: 'POL-001',
      provider: 'aia',
      start_date: '2014-03-01',
      policy_year: '7',
      premium: '100',
      cash_value_original: '110',
      variance: '20',
      as_of_year: '',
    })
  })

  it('insuranceRowDetails falls back to an empty start_date when the policy has none', () => {
    const policy = {
      id: 'p2',
      policy_number: 'POL-002',
      provider: 'aia',
      start_date: null,
    }
    const resolved = resolvePolicyAtAge([original, update], 47)!
    expect(insuranceRowDetails(policy, resolved, null, null).start_date).toBe('')
  })
})
