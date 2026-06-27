import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useSessionState } from '../hooks/useSessionState'
import { deleteReport, listReports } from '../data/medical'
import { bumpMedical, useMedicalVersion } from '../lib/medical-refresh'
import {
  applyReportView,
  DEFAULT_REPORT_LIST_CRITERIA,
  reportBodyParts,
  reportProviders,
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  type ReportListCriteria,
  type ReportSortField,
  type ReportType,
} from '../lib/medical'
import { formatFullDate } from '../lib/date'
import { routes } from '../constants/routes'
import { IconHeartbeat } from '@tabler/icons-react'
import { SwipeRow } from '../components/SwipeRow'
import { EmptyState } from '../components/EmptyState'
import { SearchBar } from '../components/SearchBar'
import { SelectMenu } from '../components/SelectMenu'
import { FilterToggleButton } from '../components/FilterToggleButton'
import { FilterPanel } from '../components/FilterPanel'
import { SortControl } from '../components/SortControl'

const TYPE_OPTIONS = [
  { value: 'all', label: 'Any Type' },
  ...REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TYPE_LABELS[t] })),
]
const SORT_OPTIONS: { value: ReportSortField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'type', label: 'Type' },
  { value: 'provider', label: 'Provider' },
  { value: 'bodyPart', label: 'Body Part' },
]

/**
 * Medical Reports — searchable/filterable/sortable list (newest first by default); tap a row →
 * Report detail, swipe-left to delete (hard, confirmed; the FK cascades the report's results). New
 * reports come from the "New Medical" bottom-nav tab. All filtering/sorting is the pure
 * `applyReportView`; this screen just holds the criteria state. Mirrors `ShowsLibrary`.
 */
export function MedicalReports() {
  const { session } = useAuth()
  const userId = session?.user.id
  const navigate = useNavigate()
  const version = useMedicalVersion()
  const [criteria, setCriteria] = useSessionState<ReportListCriteria>(
    'wellworth:medical-reports',
    DEFAULT_REPORT_LIST_CRITERIA,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const setCrit = (patch: Partial<ReportListCriteria>) =>
    setCriteria((c) => ({ ...c, ...patch }))

  const loadFn = useCallback(() => {
    if (!userId) return Promise.resolve([])
    void version // refetch after a save/delete
    return listReports(userId)
  }, [userId, version])
  const { data, loading, error } = useAsync(loadFn)

  // Optimistic delete: drop the row locally so it disappears instantly, instead of waiting for a
  // `bumpMedical()` → full-list refetch. Override resets when a real fetch lands (adjust-state-
  // during-render, not an effect — see tech-spec F16b).
  const [override, setOverride] = useState<typeof data>(undefined)
  const [syncedData, setSyncedData] = useState(data)
  if (syncedData !== data) {
    setSyncedData(data)
    setOverride(undefined)
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Delete the ${label} report? This can’t be undone.`)) return
    setOverride((prev) => (prev ?? data ?? []).filter((r) => r.id !== id))
    try {
      await deleteReport(id)
    } catch {
      bumpMedical() // resync from server on a failed delete
    }
  }

  function clearFilters() {
    setCriteria((c) => ({
      ...DEFAULT_REPORT_LIST_CRITERIA,
      query: c.query,
      sortField: c.sortField,
      sortDir: c.sortDir,
    }))
  }

  const reports = override ?? data ?? []
  const typeLabel = (t: string) => REPORT_TYPE_LABELS[t as ReportType] ?? t
  const providerOptions = [
    { value: 'all', label: 'Any Provider' },
    ...reportProviders(reports).map((p) => ({ value: p, label: p })),
  ]
  const bodyPartOptions = [
    { value: 'all', label: 'Any Body Part' },
    ...reportBodyParts(reports).map((p) => ({ value: p, label: p })),
  ]
  const view = applyReportView(reports, criteria)

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      {!loading && !error && reports.length > 0 && (
        <div className="flex items-center gap-2">
          <SearchBar
            value={criteria.query}
            onChange={(q) => setCrit({ query: q })}
            placeholder="Search body part, narrative"
            className="min-w-0 flex-1"
          />
          <FilterToggleButton
            active={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          />
        </div>
      )}

      {filtersOpen && reports.length > 0 && (
        <FilterPanel>
          <div className="grid grid-cols-2 gap-3">
            <SelectMenu
              value={criteria.reportType}
              options={TYPE_OPTIONS}
              onChange={(v) => setCrit({ reportType: v })}
            />
            <SelectMenu
              value={criteria.provider}
              options={providerOptions}
              onChange={(v) => setCrit({ provider: v })}
            />
            <SelectMenu
              value={criteria.bodyPart}
              options={bodyPartOptions}
              onChange={(v) => setCrit({ bodyPart: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <SortControl
              field={criteria.sortField}
              options={SORT_OPTIONS}
              onFieldChange={(f) => setCrit({ sortField: f })}
              dir={criteria.sortDir}
              onToggleDir={() =>
                setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
              }
            />
            <button onClick={clearFilters} className="text-accent">
              Clear Filters
            </button>
          </div>
        </FilterPanel>
      )}

      {loading && <p className="text-sm text-text-secondary">Loading…</p>}
      {error && <p className="text-sm text-danger">Couldn’t load your reports.</p>}
      {!loading && !error && reports.length === 0 && (
        <EmptyState
          title="No medical reports yet"
          actionLabel="New Medical Report"
          to={routes.medical.entry}
          Icon={IconHeartbeat}
        />
      )}
      {!loading && !error && reports.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {view.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-tertiary">
              No matches.
            </p>
          ) : (
            view.map((r) => {
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
            })
          )}
        </div>
      )}
    </div>
  )
}
