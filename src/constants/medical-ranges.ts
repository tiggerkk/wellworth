import { addMonths, startOfMonth, type IsoDate } from '../lib/date'

/**
 * Medical trend windows for the expanded single-test chart. `months: null` = All. Reports span years
 * (2021–2026 for the owner), so the windows are year-scale. Kept module-local rather than reusing the
 * net-worth ranges (those are net-worth-specific labels/keys).
 */
export interface MedicalRange {
  key: string
  label: string
  months: number | null
}

/**
 * Pure UI constants — not persisted; edit freely (add/remove/relabel windows, change the month counts)
 * and the change takes effect on reload, with no DB or other code change. The only coupling is the
 * default below, which the screen reads instead of hardcoding a key.
 */
export const MEDICAL_RANGES: MedicalRange[] = [
  { key: '1y', label: '1Y', months: 12 },
  { key: '2y', label: '2Y', months: 24 },
  { key: '3y', label: '3Y', months: 36 },
  { key: '5y', label: '5Y', months: 60 },
  { key: 'all', label: 'All', months: null },
]

/** Default selected window. Must be one of MEDICAL_RANGES' keys (keep the default here, not in the screen). */
export const MEDICAL_RANGE_DEFAULT = 'all'

/**
 * Inclusive lower-bound civil date for a window relative to `today`, or null for All. Report dates are
 * full `YYYY-MM-DD` civil dates, so a string `>=` compare against this cutoff filters the series.
 */
export function medicalRangeCutoff(
  months: number | null,
  today: IsoDate,
): IsoDate | null {
  if (months == null) return null
  return startOfMonth(addMonths(today, -months))
}
