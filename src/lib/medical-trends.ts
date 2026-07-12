/**
 * Medical Dashboard trend derivations — pure, UI-framework-free, and unit-tested. This is the
 * **data side** of the Dashboard's data/presentation split: it turns flat result rows (the tracked
 * tests' series + the latest-per-test view, fetched by `useMedicalTrends`) into per-test time series
 * + latest-value-per-test, with no knowledge of how they're drawn. `latestByCategory` re-applies
 * `latestResultPerTest` (idempotent on the already-latest view rows). The hook memoizes these; the
 * sparkline grid / expanded chart / latest-values card consume the output. A future alternate layout
 * reuses this same layer untouched.
 */
import {
  MEDICAL_CATEGORIES,
  type MedicalCategory,
  type MedicalFlag,
} from '../constants/medical'
import { labTestByKey, orderResultsForDisplay } from './medical'
import type { IsoDate } from './date'

/** The minimal shape these helpers need — `ResultWithReportMeta` satisfies it structurally. */
export interface TrendInputResult {
  test_key: string | null
  test_name: string
  category: string
  value_num: number | null
  value_text: string | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  ref_text: string | null
  flag: string | null
  report_id: string
  report_date: IsoDate
}

/** One point on a test's trend line (numeric value at a report date, with its printed flag). */
export interface MedicalTrendPoint {
  date: IsoDate
  value: number
  flag: MedicalFlag | null
  report_id: string
}

/** A tracked test with a non-empty numeric series, for a sparkline card / expanded chart. */
export interface TrackedTrend {
  key: string
  name: string
  unit: string | null
  category: MedicalCategory
  points: MedicalTrendPoint[]
}

/** Narrow the DB's `string | null` flag to the front-end union (unknown values → null). */
export function asFlag(flag: string | null): MedicalFlag | null {
  return flag === 'high' || flag === 'low' || flag === 'abnormal' ? flag : null
}

/**
 * Numeric points for one test across all reports, **sorted by report date ascending**. Rows without a
 * `value_num` (purely qualitative readings) are skipped, so a qualitative-only test yields an empty
 * series (→ no sparkline). Pure; does not mutate the input.
 */
export function buildTrendSeries<T extends TrendInputResult>(
  results: T[],
  testKey: string,
): MedicalTrendPoint[] {
  return results
    .filter((r) => r.test_key === testKey && r.value_num != null)
    .map((r) => ({
      date: r.report_date,
      value: r.value_num as number,
      flag: asFlag(r.flag),
      report_id: r.report_id,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * The most recent result **per test** across all reports — feeds the "latest values by category" card.
 * Tests are keyed by `test_key`, falling back to a normalized `test_name` for ad-hoc rows (no key).
 * Includes qualitative results (text values). Latest = greatest `report_date`; pure.
 */
export function latestResultPerTest<
  T extends { test_key: string | null; test_name: string; report_date: IsoDate },
>(results: T[]): T[] {
  const best = new Map<string, T>()
  for (const r of results) {
    const key = r.test_key ?? `name:${r.test_name.trim().toLowerCase()}`
    const cur = best.get(key)
    if (!cur || r.report_date > cur.report_date) best.set(key, r)
  }
  return [...best.values()]
}

const CATEGORY_RANK = new Map<string, number>(MEDICAL_CATEGORIES.map((c, i) => [c, i]))

/**
 * Tracked tests that actually have a numeric trend, as ordered `{ key, name, unit, points }` for the
 * sparkline grid. Filters out tracked keys with no data and any unknown key; orders by the user's
 * section + test order (the M5 profile overrides — `sectionOrder`/`testOrder`), else the canonical
 * seeded order, so the grid matches the Report-detail / latest-values ordering. `unit` is the test's
 * canonical `default_unit` (the unit the importer normalizes values to).
 */
export function trackedSeries<T extends TrendInputResult>(
  results: T[],
  trackedKeys: string[],
  sectionOrder?: string[] | null,
  testOrder?: string[] | null,
): TrackedTrend[] {
  const catRank = sectionOrder?.length
    ? new Map(sectionOrder.map((c, i) => [c, i]))
    : CATEGORY_RANK
  const testRank = testOrder?.length ? new Map(testOrder.map((k, i) => [k, i])) : null
  const LAST = Number.MAX_SAFE_INTEGER

  const out: TrackedTrend[] = []
  for (const key of trackedKeys) {
    const seed = labTestByKey.get(key)
    if (!seed) continue
    const points = buildTrendSeries(results, key)
    if (points.length === 0) continue
    out.push({
      key,
      name: seed.display_name,
      unit: seed.default_unit,
      category: seed.category,
      points,
    })
  }
  const testOf = (key: string) =>
    testRank ? (testRank.get(key) ?? LAST) : (labTestByKey.get(key)?.sort_order ?? LAST)
  return out.sort(
    (a, b) =>
      (catRank.get(a.category) ?? LAST) - (catRank.get(b.category) ?? LAST) ||
      testOf(a.key) - testOf(b.key),
  )
}

/** The most recent point of a series (series is sorted ascending), or undefined if empty. */
export function latestPoint(points: MedicalTrendPoint[]): MedicalTrendPoint | undefined {
  return points[points.length - 1]
}

/** A category header + its rows, for the Dashboard's "latest values by category" section. */
export interface CategoryGroup<T> {
  category: MedicalCategory
  rows: T[]
}

/**
 * Latest-value-per-test, grouped under category headers in the user's display order. Composes
 * `latestResultPerTest` + `orderResultsForDisplay` (which puts same-category rows contiguous), then
 * splits into groups. `sectionOrder`/`testOrder` are the profile overrides (default = seeded order).
 */
export function latestByCategory<T extends TrendInputResult>(
  results: T[],
  sectionOrder?: string[] | null,
  testOrder?: string[] | null,
): CategoryGroup<T>[] {
  const ordered = orderResultsForDisplay(
    latestResultPerTest(results),
    sectionOrder,
    testOrder,
  )
  const groups: CategoryGroup<T>[] = []
  for (const row of ordered) {
    const last = groups[groups.length - 1]
    if (last && last.category === row.category) last.rows.push(row)
    else groups.push({ category: row.category as MedicalCategory, rows: [row] })
  }
  return groups
}
