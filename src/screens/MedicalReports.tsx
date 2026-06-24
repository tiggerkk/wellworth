import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { deleteReport, listReports } from '../data/medical'
import { bumpMedical, useMedicalVersion } from '../lib/medical-refresh'
import { REPORT_TYPE_LABELS, type ReportType } from '../lib/medical'
import { formatFullDate } from '../lib/date'
import { routes } from '../constants/routes'
import { SwipeRow } from '../components/SwipeRow'
import { EmptyState } from '../components/EmptyState'

/**
 * Medical Reports — chronological list (newest first); tap a row → Report detail, swipe-left to
 * delete (hard, confirmed; the FK cascades the report's results). New reports come from the
 * "New Medical" bottom-nav tab. Mirrors `ShowsLibrary`'s swipe-delete list.
 */
export function MedicalReports() {
  const { session } = useAuth()
  const userId = session?.user.id
  const navigate = useNavigate()
  const version = useMedicalVersion()

  const loadFn = useCallback(() => {
    if (!userId) return Promise.resolve([])
    void version // refetch after a save/delete
    return listReports(userId)
  }, [userId, version])
  const { data, loading, error } = useAsync(loadFn)

  async function remove(id: string, label: string) {
    if (!confirm(`Delete the ${label} report? This can’t be undone.`)) return
    await deleteReport(id)
    bumpMedical()
  }

  const reports = data ?? []
  const typeLabel = (t: string) => REPORT_TYPE_LABELS[t as ReportType] ?? t

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {loading && <p className="text-sm text-text-secondary">Loading…</p>}
      {error && <p className="text-sm text-danger">Couldn’t load your reports.</p>}
      {!loading && !error && reports.length === 0 && (
        <EmptyState
          title="No medical reports yet"
          actionLabel="New Medical Report"
          to={routes.medical.entry}
        />
      )}
      {reports.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {reports.map((r) => {
            const secondary = [r.provider, r.body_part].filter(Boolean).join(' · ')
            return (
              <SwipeRow
                key={r.id}
                onDelete={() => void remove(r.id, typeLabel(r.report_type))}
              >
                <button
                  onClick={() => navigate(routes.medical.detail(r.id))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-text-primary">
                      {formatFullDate(r.report_date)}
                    </span>
                    <span className="block truncate text-xs text-text-secondary">
                      {typeLabel(r.report_type)}
                      {secondary ? ` · ${secondary}` : ''}
                    </span>
                  </span>
                </button>
              </SwipeRow>
            )
          })}
        </div>
      )}
    </div>
  )
}
