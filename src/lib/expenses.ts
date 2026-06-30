/**
 * Expense totals — pure, testable. The Expenses layer is the authoritative spend total (stop costs are
 * never summed). Per-currency sums stay in their own currency; the **HKD total** converts each currency
 * with one rate per currency (the trip's first-day rate, frozen on `trip.fx_rates`; see
 * `src/lib/trip-fx.ts`). A currency used by an expense but missing a rate is reported in `missing` so the
 * UI can prompt a refresh or a manual override rather than silently undercounting.
 */
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'

export type ExpenseRow = Tables<'trip_expense'>
export type ExpenseInsert = TablesInsert<'trip_expense'>
export type ExpenseUpdate = TablesUpdate<'trip_expense'>

/** Rate map: currency code → units of HKD per 1 unit. HKD is implicitly 1. */
export type RateMap = Record<string, number>

export function rateFor(currency: string, rates: RateMap): number | null {
  if (currency === 'HKD') return 1
  const r = rates[currency]
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : null
}

export function currenciesUsed(expenses: Pick<ExpenseRow, 'currency'>[]): string[] {
  return [...new Set(expenses.map((e) => e.currency))].sort()
}

export interface CurrencyTotal {
  currency: string
  cost: number
  reimbursed: number
  net: number
}

/** Sum cost / reimbursed / net per currency (no conversion). */
export function perCurrencyTotals(
  expenses: Pick<ExpenseRow, 'currency' | 'cost' | 'reimbursed_amount'>[],
): CurrencyTotal[] {
  const map = new Map<string, CurrencyTotal>()
  for (const e of expenses) {
    let t = map.get(e.currency)
    if (!t) {
      t = { currency: e.currency, cost: 0, reimbursed: 0, net: 0 }
      map.set(e.currency, t)
    }
    t.cost += e.cost
    t.reimbursed += e.reimbursed_amount ?? 0
    t.net = t.cost - t.reimbursed
  }
  return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency))
}

export interface HkdTotals {
  cost: number
  reimbursed: number
  net: number
  /** Currencies used by expenses but lacking a rate — excluded from the totals above. */
  missing: string[]
}

/** Convert every priced expense to HKD and sum; currencies without a rate land in `missing`. */
export function hkdTotals(
  expenses: Pick<ExpenseRow, 'currency' | 'cost' | 'reimbursed_amount'>[],
  rates: RateMap,
): HkdTotals {
  let cost = 0
  let reimbursed = 0
  const missing = new Set<string>()
  for (const e of expenses) {
    const rate = rateFor(e.currency, rates)
    if (rate == null) {
      missing.add(e.currency)
      continue
    }
    cost += e.cost * rate
    reimbursed += (e.reimbursed_amount ?? 0) * rate
  }
  return { cost, reimbursed, net: cost - reimbursed, missing: [...missing].sort() }
}

export interface CategoryTotal {
  key: string
  hkd: number
}

/** Per-category HKD totals (priced expenses only), sorted high → low — feeds the breakdown chart. */
export function categoryTotalsHkd(
  expenses: Pick<ExpenseRow, 'currency' | 'cost' | 'category'>[],
  rates: RateMap,
): CategoryTotal[] {
  const map = new Map<string, number>()
  for (const e of expenses) {
    const rate = rateFor(e.currency, rates)
    if (rate == null) continue
    map.set(e.category, (map.get(e.category) ?? 0) + e.cost * rate)
  }
  return [...map.entries()]
    .map(([key, hkd]) => ({ key, hkd }))
    .sort((a, b) => b.hkd - a.hkd)
}

/** Format an amount in a currency (Intl currency style; falls back to `12.00 XYZ` for odd codes). */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export const formatHkd = (amount: number): string => formatMoney(amount, 'HKD')

export interface ExpenseDateGroup {
  /** The shared `expense_date` (ISO) of the group, or `null` for undated expenses. */
  date: string | null
  expenses: ExpenseRow[]
}

/**
 * Group expenses by `expense_date`, **ascending** (chronological, matching itinerary day order);
 * undated expenses fall into a single `null` group sorted **last**. Encounter order within each group
 * is preserved — pass a list already ordered by `sort_order` (as `getTripBundle` returns) and each
 * group stays in its manual order.
 */
export function groupExpensesByDate(expenses: ExpenseRow[]): ExpenseDateGroup[] {
  const map = new Map<string | null, ExpenseRow[]>()
  for (const e of expenses) {
    const key = e.expense_date ?? null
    const arr = map.get(key)
    if (arr) arr.push(e)
    else map.set(key, [e])
  }
  return [...map.keys()]
    .sort((a, b) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b)))
    .map((date) => ({ date, expenses: map.get(date)! }))
}
