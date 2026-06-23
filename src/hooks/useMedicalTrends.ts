import { useCallback, useMemo } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useProfile } from './useProfile'
import { useAsync } from './useAsync'
import { useMedicalVersion } from '../lib/medical-refresh'
import {
  listResultsWithReportMeta,
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
 * The **single data seam** for the Medical Dashboard. Loads every result (joined to its report date)
 * + the reports list in one async pass (refetching on the `bumpMedical` tick), reads the tracked-test
 * set + display-order overrides from the profile, and memoizes the pure derivations from
 * `lib/medical-trends`. Presentation (sparkline grid, expanded chart, latest-values card) consumes
 * only this hook — so a future alternate layout is a new component over the same data, no refetch.
 */
export function useMedicalTrends(): MedicalTrends {
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useMedicalVersion()
  const { data: profile } = useProfile()

  const fn = useCallback(() => {
    void version // refetch after a report SAVE / delete (bumpMedical)
    if (!userId) {
      return Promise.resolve({
        results: [] as ResultWithReportMeta[],
        reports: [] as MedicalReportRow[],
      })
    }
    return Promise.all([listResultsWithReportMeta(userId), listReports(userId)]).then(
      ([results, reports]) => ({ results, reports }),
    )
  }, [userId, version])

  const { data, loading, error } = useAsync(fn)

  // Memoize the fallbacks so the derivations below don't re-run on every render (a bare `?? []` /
  // `?? defaultTrackedTestKeys()` would build a fresh array each time).
  const results = useMemo(() => data?.results ?? [], [data])
  const reports = useMemo(() => data?.reports ?? [], [data])
  const trackedKeys = useMemo(
    () => profile?.medical_tracked_tests ?? defaultTrackedTestKeys(),
    [profile],
  )
  const sectionOrder = profile?.medical_section_order
  const testOrder = profile?.medical_test_order

  const tracked = useMemo(
    () => trackedSeries(results, trackedKeys, sectionOrder, testOrder),
    [results, trackedKeys, sectionOrder, testOrder],
  )
  const grouped = useMemo(
    () => latestByCategory(results, sectionOrder, testOrder),
    [results, sectionOrder, testOrder],
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
