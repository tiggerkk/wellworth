import { describe, expect, it } from 'vitest'
import {
  categoryTotalsHkd,
  currenciesUsed,
  groupExpensesByDate,
  hkdTotals,
  perCurrencyTotals,
  rateFor,
  type ExpenseRow,
} from './expenses'

function exp(p: Partial<ExpenseRow>): ExpenseRow {
  return {
    id: 'e',
    user_id: 'u',
    trip_id: 't',
    expense_date: '2026-03-28',
    description: 'x',
    category: 'restaurant',
    cost: 0,
    currency: 'CNY',
    reimbursed_formula: null,
    reimbursed_amount: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...p,
  }
}

describe('rateFor', () => {
  it('HKD is 1, missing/invalid is null', () => {
    expect(rateFor('HKD', {})).toBe(1)
    expect(rateFor('CNY', { CNY: 1.1 })).toBe(1.1)
    expect(rateFor('CNY', {})).toBeNull()
    expect(rateFor('CNY', { CNY: 0 })).toBeNull()
  })
})

describe('perCurrencyTotals', () => {
  it('groups cost/reimbursed/net per currency', () => {
    const out = perCurrencyTotals([
      exp({ currency: 'CNY', cost: 100, reimbursed_amount: 40 }),
      exp({ currency: 'CNY', cost: 50 }),
      exp({ currency: 'USD', cost: 10 }),
    ])
    expect(out).toEqual([
      { currency: 'CNY', cost: 150, reimbursed: 40, net: 110 },
      { currency: 'USD', cost: 10, reimbursed: 0, net: 10 },
    ])
  })
})

describe('hkdTotals', () => {
  it('converts priced currencies and reports missing ones', () => {
    const t = hkdTotals(
      [
        exp({ currency: 'CNY', cost: 100, reimbursed_amount: 50 }),
        exp({ currency: 'USD', cost: 10 }),
        exp({ currency: 'TWD', cost: 1000 }),
      ],
      { CNY: 1.1, USD: 7.8 },
    )
    expect(t.cost).toBeCloseTo(188)
    expect(t.reimbursed).toBeCloseTo(55)
    expect(t.net).toBeCloseTo(133)
    expect(t.missing).toEqual(['TWD'])
  })
})

describe('categoryTotalsHkd', () => {
  it('sums per category in HKD, excludes unpriced, sorts desc', () => {
    const out = categoryTotalsHkd(
      [
        exp({ category: 'hotel', currency: 'CNY', cost: 100 }),
        exp({ category: 'food', currency: 'USD', cost: 10 }),
        exp({ category: 'shopping', currency: 'TWD', cost: 999 }),
      ],
      { CNY: 1.1, USD: 7.8 },
    )
    expect(out.map((o) => o.key)).toEqual(['hotel', 'food']) // sorted desc, TWD excluded
    expect(out[0]!.hkd).toBeCloseTo(110)
    expect(out[1]!.hkd).toBeCloseTo(78)
  })
})

describe('currenciesUsed', () => {
  it('distinct + sorted', () => {
    expect(
      currenciesUsed([
        exp({ currency: 'USD' }),
        exp({ currency: 'CNY' }),
        exp({ currency: 'USD' }),
      ]),
    ).toEqual(['CNY', 'USD'])
  })
})

describe('groupExpensesByDate', () => {
  it('groups by date ascending, undated last, preserves within-group order', () => {
    const groups = groupExpensesByDate([
      exp({ id: 'b', expense_date: '2026-03-29' }),
      exp({ id: 'a1', expense_date: '2026-03-28' }),
      exp({ id: 'u1', expense_date: null }),
      exp({ id: 'a2', expense_date: '2026-03-28' }),
    ])
    expect(groups.map((g) => g.date)).toEqual(['2026-03-28', '2026-03-29', null])
    // within-group encounter order is preserved (a1 before a2)
    expect(groups[0]!.expenses.map((e) => e.id)).toEqual(['a1', 'a2'])
    expect(groups[2]!.expenses.map((e) => e.id)).toEqual(['u1'])
  })

  it('returns [] for no expenses', () => {
    expect(groupExpensesByDate([])).toEqual([])
  })
})
