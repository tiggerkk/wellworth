import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconFileCertificate } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useSessionState } from '../hooks/useSessionState'
import { listCatalogue } from '../data/insurance'
import { useNetWorthVersion } from '../lib/networth-refresh'
import {
  applyInsuranceView,
  DEFAULT_INSURANCE_CRITERIA,
  type InsuranceCriteria,
  type InsuranceSortField,
  type InsuranceStatusFilter,
} from '../lib/insurance-view'
import { ageForYear, DEFAULT_BIRTH_YEAR, hasBrokenEven } from '../lib/networth'
import { effectiveProviders, providerLabel } from '../lib/insurance-config'
import { formatFullDate, todayLocal } from '../lib/date'
import { StatusChip } from '../components/StatusChip'
import { routes } from '../constants/routes'
import { SearchBar } from '../components/SearchBar'
import { SelectMenu } from '../components/SelectMenu'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { Toggle } from '../components/Toggle'
import { Calendar } from '../components/Calendar'
import { FilterToggleButton } from '../components/FilterToggleButton'
import { FilterPanel } from '../components/FilterPanel'
import { DateRangeRow } from '../components/DateRangeRow'
import { ResultCount } from '../components/ResultCount'
import { SortControl } from '../components/SortControl'
import { EmptyState } from '../components/EmptyState'

const SORT_OPTIONS: { value: InsuranceSortField; label: string }[] = [
  { value: 'startDate', label: 'Start Date' },
  { value: 'policyNumber', label: 'Policy Number' },
  { value: 'policyName', label: 'Policy Name' },
  { value: 'provider', label: 'Provider' },
]

const STATUS_OPTIONS: { value: InsuranceStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'matured', label: 'Matured' },
  { value: 'surrendered', label: 'Surrendered' },
]

/**
 * Insurance Policies — searchable/filterable/sortable policy list (mirrors Medical Reports). Tap a
 * row → New/Edit Insurance. New policies come from the "New Insurance" bottom-nav tab. Break-even /
 * surrendered filters are computed from the bounded catalogue client-side.
 */
export function InsurancePolicies() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  const providers = effectiveProviders(profile?.insurance_providers)
  const version = useNetWorthVersion()
  const [criteria, setCriteria] = useSessionState<InsuranceCriteria>(
    'wellworth:networth-insurance',
    DEFAULT_INSURANCE_CRITERIA,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [whichDate, setWhichDate] = useState<'startFrom' | 'startTo' | null>(null)
  const setCrit = (patch: Partial<InsuranceCriteria>) =>
    setCriteria((c) => ({ ...c, ...patch }))

  const loadFn = useCallback(() => {
    void version
    if (!userId) return Promise.resolve([])
    return listCatalogue(userId)
  }, [userId, version])
  const { data, loading, error } = useAsync(loadFn)

  const items = data ?? []
  const birthYear = profile?.birthday
    ? Number(profile.birthday.slice(0, 4))
    : DEFAULT_BIRTH_YEAR
  const currentAge = ageForYear(Number(todayLocal().slice(0, 4)), birthYear)
  const providerOptions = [
    { value: 'all', label: 'Any Provider' },
    ...providers
      .filter((p) => items.some((i) => i.policy.provider === p.key))
      .map((p) => ({ value: p.key, label: p.label })),
  ]
  const view = applyInsuranceView(items, criteria, currentAge)

  function clearFilters() {
    setCriteria((c) => ({
      ...DEFAULT_INSURANCE_CRITERIA,
      query: c.query,
      sortField: c.sortField,
      sortDir: c.sortDir,
    }))
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      {!error && (loading || items.length > 0) && (
        <div className="flex items-center gap-2">
          <SearchBar
            value={criteria.query}
            onChange={(q) => setCrit({ query: q })}
            placeholder="Search policy number, policy name, notes"
            className="min-w-0 flex-1"
          />
          <FilterToggleButton
            active={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          />
        </div>
      )}

      {filtersOpen && items.length > 0 && (
        <FilterPanel>
          <div className="grid grid-cols-2 gap-3">
            <SelectMenu
              value={criteria.provider}
              options={providerOptions}
              onChange={(v) => setCrit({ provider: v })}
            />
            <label className="flex items-center justify-between self-end py-1.5">
              <span className="text-text-secondary">Past Break-Even Only</span>
              <Toggle
                checked={criteria.brokeEvenOnly}
                onChange={(v) => setCrit({ brokeEvenOnly: v })}
                label="Past Break-Even Only"
              />
            </label>
          </div>
          <SegmentedTabs
            value={criteria.status}
            options={STATUS_OPTIONS}
            onChange={(v) => setCrit({ status: v })}
          />
          <DateRangeRow
            label="Started"
            from={criteria.startFrom}
            to={criteria.startTo}
            onPickFrom={() => setWhichDate('startFrom')}
            onPickTo={() => setWhichDate('startTo')}
            onClearFrom={() => setCrit({ startFrom: null })}
            onClearTo={() => setCrit({ startTo: null })}
          />
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

      {loading && <p className="text-body text-text-secondary">Loading…</p>}
      {error && <p className="text-body text-danger">Couldn’t load your policies.</p>}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="No insurance policies yet"
          actionLabel="New Insurance"
          to={routes.networth.insuranceEntry}
          Icon={IconFileCertificate}
        />
      )}
      {!loading && !error && items.length > 0 && view.length > 0 && (
        <ResultCount count={view.length} />
      )}
      {!loading && !error && items.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {view.length === 0 ? (
            <p className="px-4 py-6 text-center text-body text-text-tertiary">
              No matches.
            </p>
          ) : (
            view.map(({ policy, schedules }) => {
              const brokeEven = hasBrokenEven(schedules, currentAge)
              return (
                <button
                  key={policy.id}
                  onClick={() => navigate(routes.networth.insuranceEdit(policy.id))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text-primary">
                      {policy.policy_name || policy.policy_number}
                    </span>
                    <span className="block truncate text-caption text-text-secondary">
                      {policy.policy_number}
                      {policy.start_date ? ` · ${formatFullDate(policy.start_date)}` : ''}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-caption text-text-tertiary">
                      <span>{providerLabel(providers, policy.provider)}</span>
                      {policy.termination_kind === 'surrendered' && (
                        <StatusChip
                          label="Surrendered"
                          className="bg-track text-text-secondary"
                        />
                      )}
                      {policy.termination_kind === 'matured' && (
                        <StatusChip label="Matured" className="bg-accent text-bg" />
                      )}
                      {brokeEven && (
                        <StatusChip
                          label="Past Break-Even"
                          className="bg-positive text-bg"
                        />
                      )}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}

      {whichDate && (
        <Calendar
          day={
            (whichDate === 'startFrom' ? criteria.startFrom : criteria.startTo) ??
            todayLocal()
          }
          onSelect={(d) => {
            setCrit(whichDate === 'startFrom' ? { startFrom: d } : { startTo: d })
            setWhichDate(null)
          }}
          onClose={() => setWhichDate(null)}
        />
      )}
    </div>
  )
}
