import { describe, expect, it } from 'vitest'
import { ASSET_TYPES, formatHkd, groupByType, totalBase, valueBase } from './networth'

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
