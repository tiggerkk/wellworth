import { describe, expect, it } from 'vitest'
import {
  ASSET_TYPES,
  formatHkd,
  formatHkdCompact,
  groupByType,
  totalBase,
  typeBreakdown,
  typeTotals,
  valueBase,
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
