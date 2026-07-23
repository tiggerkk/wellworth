import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconFileCertificate, IconPlus } from '@tabler/icons-react'
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
import { DEFAULT_BIRTH_YEAR } from '../constants/networth'
import { ageForYear, hasBrokenEven } from '../lib/networth'
import { effectiveProviders, providerColor, providerLabel } from '../lib/insurance-config'
import { todayLocal } from '../lib/date'
import { routes } from '../constants/routes'
import { SelectMenu } from '../components/SelectMenu'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { Toggle } from '../components/Toggle'
import { InsurancePolicyHeader } from '../components/InsurancePolicyHeader'
import { ListRow } from '../components/ListRow'
import { Calendar } from '../components/Calendar'
import { ListSearchFilterPanel, ResultCount } from '../components/ListSearchFilterPanel'
import { DateRangeRow } from '../components/DateRangeRow'
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
 * Insurance Policies — searchable/filterable/sortable policy list. Tap a row → New/Edit Insurance.
 * New policies come from the teal "+ New Insurance" action on the result- count row (and the
 * empty-state action) — the entry point that replaced the old bottom-nav tab.
 * Break-even / surrendered filters are computed from the bounded catalogue client-side.
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

  const items = useMemo(() => data ?? [], [data])
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
  // `applyInsuranceView` filters/sorts the whole catalogue, and `hasBrokenEven` walks each policy's
  // resolved series — both worth gating behind useMemo so opening the filter panel or typing in an
  // unrelated field (state changes that don't affect `items`/`criteria`/`currentAge`) doesn't re-run
  // them. Break-even is computed once here per item rather than again per row during render.
  const view = useMemo(() => {
    const filtered = applyInsuranceView(items, criteria, currentAge)
    return filtered.map((item) => ({
      ...item,
      brokeEven: hasBrokenEven(item.schedules, currentAge),
    }))
  }, [items, criteria, currentAge])

  function clearFilters() {
    setCriteria(() => ({
      ...DEFAULT_INSURANCE_CRITERIA,
      //query: c.query,
      //sortField: c.sortField,
      //sortDir: c.sortDir,
    }))
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <ListSearchFilterPanel
        query={criteria.query}
        onQueryChange={(q) => setCrit({ query: q })}
        placeholder="Search policy number, policy name, notes"
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        hideSearch={!!error}
        hideFilters={!!error || items.length === 0}
        sortField={criteria.sortField}
        sortOptions={SORT_OPTIONS}
        onSortFieldChange={(f) => setCrit({ sortField: f })}
        sortDir={criteria.sortDir}
        onToggleSortDir={() =>
          setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
        }
        onClearFilters={clearFilters}
        hasActiveFilters={
          JSON.stringify(criteria) !== JSON.stringify(DEFAULT_INSURANCE_CRITERIA)
        }
        filters={
          <>
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
          </>
        }
        loading={loading}
        error={error}
        data={data}
        errorText="Couldn’t load your policies."
        emptyState={
          <EmptyState
            title="No insurance policies yet"
            actionLabel="New Insurance"
            to={routes.networth.insuranceEntry}
            Icon={IconFileCertificate}
          />
        }
      >
        {() => (
          <>
            {/* "XX results" on the left; "+ New Insurance" is the entry point at the right edge (the
                bottom-nav tab was removed, so this — and the empty-state action — replace it). */}
            <div className="flex items-center">
              {view.length > 0 && <ResultCount count={view.length} />}
              <button
                onClick={() => navigate(routes.networth.insuranceEntry)}
                className="ml-auto flex items-center gap-1 px-1 text-body text-positive"
              >
                <IconPlus size={16} /> New Insurance
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {view.length === 0 ? (
                <p className="rounded-card border border-border bg-surface px-4 py-6 text-center text-body text-text-tertiary">
                  No matches.
                </p>
              ) : (
                view.map(({ policy, brokeEven }) => (
                  <ListRow
                    key={policy.id}
                    color={providerColor(providers, policy.provider)}
                    onClick={() => navigate(routes.networth.insuranceEdit(policy.id))}
                  >
                    <InsurancePolicyHeader
                      policyNumber={policy.policy_number}
                      startDate={policy.start_date}
                      providerLabel={providerLabel(providers, policy.provider)}
                      policyName={policy.policy_name || policy.policy_number}
                      terminationKind={
                        policy.termination_kind as 'surrendered' | 'matured' | null
                      }
                      brokeEven={brokeEven}
                      truncate
                    />
                  </ListRow>
                ))
              )}
            </div>
          </>
        )}
      </ListSearchFilterPanel>

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
