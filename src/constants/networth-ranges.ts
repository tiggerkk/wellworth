import { addMonths, startOfMonth, type IsoDate } from '../lib/date'

/** Net Worth dashboard trend windows (docs/06-networth.md). `months: null` = All. */
export interface NetWorthRange {
  key: string
  label: string
  months: number | null
}

export const NETWORTH_RANGES: NetWorthRange[] = [
  { key: '6m', label: '6M', months: 6 },
  { key: '12m', label: '12M', months: 12 },
  { key: '2y', label: '2Y', months: 24 },
  { key: '3y', label: '3Y', months: 36 },
  { key: '5y', label: '5Y', months: 60 },
  { key: 'all', label: 'All', months: null },
]

/** Inclusive lower-bound month for a window relative to `today`, or null for All. */
export function rangeCutoff(months: number | null, today: IsoDate): IsoDate | null {
  if (months == null) return null
  return startOfMonth(addMonths(today, -(months - 1)))
}
