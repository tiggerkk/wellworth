import { useCallback, useMemo } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from './useProfile'
import { useAsync } from './useAsync'
import { useMedicalVersion } from '../lib/medical-refresh'
import {
  listLatestResultPerTest,
  listTrackedResultSeries,
  listReports,
  type ResultWithReportMeta,
} from '../data/medical'
import { defaultTrackedTestKeys, type MedicalReportRow } from '../lib/medical'
import {
  latestByCategory,
  trackedSeries,
  type CategoryGroup,
  type TrackedTrend,
} from '../lib/medical-trends'

export interface MedicalTrends {
  loading: boolean
  error: Error | undefined
  /** Tracked tests with a numeric series, ordered for the sparkline grid (empty = nothing to trend). */
  tracked: TrackedTrend[]
  /** Latest value per test, grouped by category in the user's display order. */
  latestByCategory: CategoryGroup<ResultWithReportMeta>[]
  /** All reports, newest first — for the timeline (incl. narrative reports with no results). */
  recentReports: MedicalReportRow[]
  /** True once loaded with zero reports — drives the dashboard's empty state. */
  isEmpty: boolean
}

/**
 * The **single data seam** for the Medical Dashboard. Loads three **bounded** queries in one async
 * pass (refetching on the `bumpMedical` tick): the latest result per test (DB view — the latest card),
 * the result history for just the tracked tests (the sparklines), and the reports list (the timeline).
 * It never fetches every historical result of every test. Reads the tracked-test set + display-order
 * overrides from the profile, and memoizes the pure derivations from `lib/medical-trends`. Presentation
 * (sparkline grid, expanded chart, latest-values card) consumes only this hook.
 */
export function useMedicalTrends(): MedicalTrends {
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useMedicalVersion()
  const { data: profile } = useProfile()

  // The tracked-test set scopes the sparkline fetch, so it's computed BEFORE the fetch (memoized so a
  // bare `?? []` / `?? defaultTrackedTestKeys()` doesn't churn the fetch dep every render).
  const trackedKeys = useMemo(
    () => profile?.medical_tracked_tests ?? defaultTrackedTestKeys(),
    [profile],
  )
  const sectionOrder = profile?.medical_section_order
  const testOrder = profile?.medical_test_order

  const fn = useCallback(() => {
    void version // refetch after a report SAVE / delete (bumpMedical)
    if (!userId) {
      return Promise.resolve({
        latest: [] as ResultWithReportMeta[],
        series: [] as ResultWithReportMeta[],
        reports: [] as MedicalReportRow[],
      })
    }
    return Promise.all([
      listLatestResultPerTest(userId),
      listTrackedResultSeries(userId, trackedKeys),
      listReports(userId),
    ]).then(([latest, series, reports]) => ({ latest, series, reports }))
  }, [userId, version, trackedKeys])

  const { data, loading, error } = useAsync(fn)

  const latest = useMemo(() => data?.latest ?? [], [data])
  const series = useMemo(() => data?.series ?? [], [data])
  const reports = useMemo(() => data?.reports ?? [], [data])

  const tracked = useMemo(
    () => trackedSeries(series, trackedKeys, sectionOrder, testOrder),
    [series, trackedKeys, sectionOrder, testOrder],
  )
  const grouped = useMemo(
    () => latestByCategory(latest, sectionOrder, testOrder),
    [latest, sectionOrder, testOrder],
  )

  return {
    loading,
    error,
    tracked,
    latestByCategory: grouped,
    recentReports: reports,
    isEmpty: !loading && !error && reports.length === 0,
  }
}
