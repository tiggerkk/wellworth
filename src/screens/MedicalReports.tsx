import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useSessionState } from '../hooks/useSessionState'
import { deleteReport, listReports } from '../data/medical'
import { bumpMedical, useMedicalVersion } from '../lib/medical-refresh'
import { REPORT_TYPES, REPORT_TYPE_LABELS } from '../constants/medical'
import {
  applyReportView,
  DEFAULT_REPORT_LIST_CRITERIA,
  reportBodyParts,
  reportProviders,
  type ReportListCriteria,
  type ReportSortField,
} from '../lib/medical'
import { routes } from '../constants/routes'
import { IconHeartbeat } from '@tabler/icons-react'
import { ListRow } from '../components/ListRow'
import { MedicalRowHeader } from '../components/MedicalRowHeader'
import { EmptyState } from '../components/EmptyState'
import { SelectMenu } from '../components/SelectMenu'
import { ListSearchFilterPanel, ResultCount } from '../components/ListSearchFilterPanel'

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
 * Report detail, swipe-left to delete (hard, immediate; the FK cascades the report's results). New
 * reports come from the "New Medical" bottom-nav tab. All filtering/sorting is the pure
 * `applyReportView`; this screen just holds the criteria state.
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

  async function remove(id: string) {
    setOverride((prev) => (prev ?? data ?? []).filter((r) => r.id !== id))
    try {
      await deleteReport(id)
    } catch {
      bumpMedical() // resync from server on a failed delete
    }
  }

  function clearFilters() {
    setCriteria(() => ({
      ...DEFAULT_REPORT_LIST_CRITERIA,
      //query: c.query,
      //sortField: c.sortField,
      //sortDir: c.sortDir,
    }))
  }

  const reports = override ?? data ?? []
  const providerOptions = [
    { value: 'all', label: 'Any Provider' },
    ...reportProviders(reports).map((p) => ({ value: p, label: p })),
  ]
  const bodyPartOptions = [
    { value: 'all', label: 'Any Body Part' },
    ...reportBodyParts(reports).map((p) => ({ value: p, label: p })),
  ]
  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <ListSearchFilterPanel
        query={criteria.query}
        onQueryChange={(q) => setCrit({ query: q })}
        placeholder="Search body part, narrative"
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        hideSearch={!!error}
        hideFilters={!!error || reports.length === 0}
        sortField={criteria.sortField}
        sortOptions={SORT_OPTIONS}
        onSortFieldChange={(f) => setCrit({ sortField: f })}
        sortDir={criteria.sortDir}
        onToggleSortDir={() =>
          setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
        }
        onClearFilters={clearFilters}
        filters={
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
        }
        loading={loading}
        error={error}
        data={override ?? data}
        errorText="Couldn’t load your reports."
        emptyState={
          <EmptyState
            title="No medical reports yet"
            actionLabel="New Medical Report"
            to={routes.medical.entry}
            Icon={IconHeartbeat}
          />
        }
      >
        {(all) => {
          const view = applyReportView(all, criteria)
          return (
            <>
              {view.length > 0 && <ResultCount count={view.length} />}
              <div className="flex flex-col gap-2">
                {view.length === 0 ? (
                  <p className="rounded-card border border-border bg-surface px-4 py-6 text-center text-body text-text-tertiary">
                    No matches.
                  </p>
                ) : (
                  view.map((r) => (
                    <ListRow
                      key={r.id}
                      onDelete={() => void remove(r.id)}
                      onClick={() => navigate(routes.medical.detail(r.id))}
                    >
                      <MedicalRowHeader report={r} />
                    </ListRow>
                  ))
                )}
              </div>
            </>
          )
        }}
      </ListSearchFilterPanel>
    </div>
  )
}
