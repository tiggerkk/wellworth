import { addMonths, startOfMonth, type IsoDate } from '../lib/date'

/** Net Worth dashboard trend windows. `months: null` = All. */
export interface NetWorthRange {
  key: string
  label: string
  months: number | null
}

/**
 * Pure UI constants — not persisted; edit freely (add/remove/relabel windows, change the month counts)
 * and the change takes effect on reload, with no DB or other code change. The only coupling is the
 * default below, which the screen reads instead of hardcoding a key.
 */
export const NETWORTH_RANGES: NetWorthRange[] = [
  { key: '6m', label: '6M', months: 6 },
  { key: '12m', label: '12M', months: 12 },
  { key: '2y', label: '2Y', months: 24 },
  { key: '3y', label: '3Y', months: 36 },
  { key: '5y', label: '5Y', months: 60 },
  { key: 'all', label: 'All', months: null },
]

/** Default selected window. Must be one of NETWORTH_RANGES' keys (keep the default here, not in the screen). */
export const NETWORTH_RANGE_DEFAULT = 'all'

/** Inclusive lower-bound month for a window relative to `today`, or null for All. */
export function rangeCutoff(months: number | null, today: IsoDate): IsoDate | null {
  if (months == null) return null
  return startOfMonth(addMonths(today, -(months - 1)))
}
