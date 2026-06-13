import { addDays, fromIsoDate, toIsoDate, type IsoDate } from '../lib/date'

export interface DateRange {
  from: IsoDate
  to: IsoDate
}

export interface RangeOption {
  key: string
  label: string
  toRange: (today: IsoDate) => DateRange
}

const lastNDays =
  (n: number) =>
  (today: IsoDate): DateRange => ({ from: addDays(today, -(n - 1)), to: today })

const monthsAgo =
  (n: number) =>
  (today: IsoDate): DateRange => {
    const d = fromIsoDate(today)
    d.setMonth(d.getMonth() - n)
    return { from: toIsoDate(d), to: today }
  }

/** Dashboard range options (docs/01-screens.md). Last 7 Days is the default. */
export const RANGES: RangeOption[] = [
  { key: '7d', label: 'Last 7 Days', toRange: lastNDays(7) },
  { key: '2w', label: 'Last 2 Weeks', toRange: lastNDays(14) },
  { key: '3w', label: 'Last 3 Weeks', toRange: lastNDays(21) },
  { key: '4w', label: 'Last 4 Weeks', toRange: lastNDays(28) },
  { key: '8w', label: 'Last 8 Weeks', toRange: lastNDays(56) },
  { key: '3m', label: 'Last 3 Months', toRange: monthsAgo(3) },
  { key: '6m', label: 'Last 6 Months', toRange: monthsAgo(6) },
  { key: '1y', label: 'Last Year', toRange: monthsAgo(12) },
]
