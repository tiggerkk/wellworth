import { describe, expect, it } from 'vitest'
import {
  buildExpenses,
  parseAmount,
  parseDate,
  parseExpenseCsv,
} from './travel-expense-import'
import { defaultCategories } from './travel-config'

const cats = defaultCategories()

describe('parseAmount', () => {
  it('strips symbols and thousands separators', () => {
    expect(parseAmount('¥2,067')).toBe(2067)
    expect(parseAmount('1,234.50')).toBe(1234.5)
    expect(parseAmount('HK$ 88')).toBe(88)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('-')).toBeNull()
    expect(parseAmount(undefined)).toBeNull()
  })
})

describe('parseDate', () => {
  it('normalizes to YYYY-MM-DD', () => {
    expect(parseDate('2026-03-28')).toBe('2026-03-28')
    expect(parseDate('2026/3/8')).toBe('2026-03-08')
    expect(parseDate('nope')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('parseExpenseCsv', () => {
  it('classifies reserved / category / unknown columns', () => {
    const text =
      'Trip,Date,Restaurant,Hotel,Local Transit,Flight/Train,Cost,Re-imbursed,Mystery\n' +
      '湖北,2026-03-28,,200,,,200,,x\n'
    const p = parseExpenseCsv(text, cats)
    expect(p.errors).toEqual([])
    expect(p.tripCol).toBe(0)
    expect(p.dateCol).toBe(1)
    expect(p.costCol).toBe(6)
    expect(p.reimbursedCol).toBe(7)
    expect(p.categoryCols.map((c) => c.key)).toEqual([
      'restaurant',
      'hotel',
      'local_transit',
      'flight_train',
    ])
    expect(p.unknownCols.map((c) => c.header)).toEqual(['Mystery'])
    expect(p.dataRows).toHaveLength(1)
  })

  it('errors when the Trip column is missing', () => {
    const p = parseExpenseCsv('Date,Cost\n2026-01-01,10\n', cats)
    expect(p.errors[0]).toMatch(/Trip/)
  })
})

describe('buildExpenses', () => {
  const header = 'Trip,Date,Restaurant,Shopping,Hotel,Cost,Re-imbursed,Mystery\n'

  it('makes one expense per row for a single category', () => {
    const p = parseExpenseCsv(header + '湖北,2026-03-28,,,200,200,,\n', cats)
    const { expenses } = buildExpenses(p, cats, {})
    expect(expenses).toHaveLength(1)
    expect(expenses[0]).toMatchObject({
      tripName: '湖北',
      expense_date: '2026-03-28',
      category: 'hotel',
      description: 'Hotel',
      cost: 200,
      reimbursed_amount: null,
    })
  })

  it('splits a multi-category row and allocates reimbursed pro-rata', () => {
    const p = parseExpenseCsv(header + 'Trip A,2026-03-28,40,70,,110,55,\n', cats)
    const { expenses, warnings } = buildExpenses(p, cats, {})
    expect(expenses.map((e) => [e.category, e.cost, e.reimbursed_amount])).toEqual([
      ['restaurant', 40, 20], // 55 * 40/110 = 20
      ['shopping', 70, 35], // remainder 55 - 20 = 35
    ])
    expect(warnings).toEqual([]) // 40 + 70 === Cost 110
  })

  it('warns when the category sum ≠ Cost', () => {
    const p = parseExpenseCsv(header + 'Trip A,2026-03-28,40,70,,200,,\n', cats)
    const { warnings } = buildExpenses(p, cats, {})
    expect(warnings.some((w) => /≠ Cost 200/.test(w))).toBe(true)
  })

  it('falls back to the first category when only Cost is filled', () => {
    const p = parseExpenseCsv(header + 'Trip A,2026-03-28,,,,50,,\n', cats)
    const { expenses, warnings } = buildExpenses(p, cats, {})
    expect(expenses[0]).toMatchObject({ category: 'restaurant', cost: 50 })
    expect(warnings.some((w) => /no category column/.test(w))).toBe(true)
  })

  it('uses the unknown-header mapping (and skips unmapped)', () => {
    const p = parseExpenseCsv(header + 'Trip A,2026-03-28,,,,30,,30\n', cats)
    const skipped = buildExpenses(p, cats, {}) // Mystery unmapped → falls back to Cost
    expect(skipped.expenses[0]!.category).toBe('restaurant')
    const mapped = buildExpenses(p, cats, { Mystery: 'activity' })
    expect(mapped.expenses.map((e) => [e.category, e.cost])).toEqual([['activity', 30]])
  })

  it('groups by trip', () => {
    const p = parseExpenseCsv(
      header + 'A,2026-03-01,10,,,10,,\nA,2026-03-02,,,20,20,,\nB,2026-03-03,5,,,5,,\n',
      cats,
    )
    const { byTrip } = buildExpenses(p, cats, {})
    expect(byTrip).toEqual([
      { tripName: 'A', count: 2, total: 30 },
      { tripName: 'B', count: 1, total: 5 },
    ])
  })
})
