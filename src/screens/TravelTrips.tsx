import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconWorld } from '@tabler/icons-react'
import { SearchBar } from '../components/SearchBar'
import { SelectMenu } from '../components/SelectMenu'
import { SwipeRow } from '../components/SwipeRow'
import { StatusChip } from '../components/StatusChip'
import { Thumb } from '../components/Thumb'
import { PrimaryButton } from '../components/PrimaryButton'
import { FilterToggleButton } from '../components/FilterToggleButton'
import { FilterPanel } from '../components/FilterPanel'
import { SortControl } from '../components/SortControl'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { deleteTrip, listTripFacetRows, listTrips } from '../data/travel'
import { bumpTravel, useTravelVersion } from '../lib/travel-refresh'
import {
  DEFAULT_TRIP_LIST_CRITERIA,
  TRIP_STATUS_CHIP,
  applyTripList,
  facetsForStops,
  primaryLabel,
  tripStatusLabel,
  tripYear,
  type TripFacets,
  type TripListCriteria,
  type TripSortField,
} from '../lib/travel'
import { TRIP_STATUSES } from '../constants/travel'
import { routes } from '../constants/routes'
import { formatFullDate, formatMonthDay } from '../lib/date'

const RATING_OPTIONS = [
  { value: '0', label: 'Any Rating' },
  { value: '1', label: '1★+' },
  { value: '2', label: '2★+' },
  { value: '3', label: '3★+' },
  { value: '4', label: '4★+' },
  { value: '5', label: '5★' },
]
const SORT_OPTIONS: { value: TripSortField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'country', label: 'Country' },
  { value: 'province', label: 'Province' },
  { value: 'city', label: 'City' },
  { value: 'status', label: 'Status' },
  { value: 'name', label: 'Trip Name' },
]

function dateRange(start: string | null, end: string | null): string {
  if (start && end) return `${formatMonthDay(start)} – ${formatFullDate(end)}`
  if (start) return formatFullDate(start)
  return 'No dates yet'
}

export function TravelTrips() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useTravelVersion()
  const [criteria, setCriteria] = useState<TripListCriteria>(DEFAULT_TRIP_LIST_CRITERIA)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const fn = useCallback(() => {
    void version
    if (!userId) return Promise.resolve(null)
    return Promise.all([listTrips(userId), listTripFacetRows(userId)])
  }, [userId, version])
  const { data, loading, error } = useAsync(fn)

  const [trips, facetRows] = data ?? [[], []]

  const facetsByTrip = useMemo(() => {
    const byTrip = new Map<string, TripFacets>()
    const grouped = new Map<
      string,
      { city: string | null; country: string | null; province: string | null }[]
    >()
    for (const r of facetRows) {
      const arr = grouped.get(r.trip_id) ?? []
      arr.push(r)
      grouped.set(r.trip_id, arr)
    }
    for (const [tripId, rows] of grouped) byTrip.set(tripId, facetsForStops(rows))
    return byTrip
  }, [facetRows])

  const countries = useMemo(() => {
    const s = new Set<string>()
    for (const f of facetsByTrip.values()) for (const c of f.countries) s.add(c)
    return [...s].sort()
  }, [facetsByTrip])

  const provinces = useMemo(() => {
    const s = new Set<string>()
    for (const f of facetsByTrip.values()) for (const p of f.provinces) s.add(p)
    return [...s].sort()
  }, [facetsByTrip])

  const years = useMemo(() => {
    const s = new Set<string>()
    for (const t of trips) {
      const y = tripYear(t)
      if (y) s.add(y)
    }
    return [...s].sort((a, b) => b.localeCompare(a))
  }, [trips])

  const view = applyTripList(trips, facetsByTrip, criteria)

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This also deletes its days, stops, and expenses.`))
      return
    await deleteTrip(id)
    bumpTravel()
  }

  const set = (patch: Partial<TripListCriteria>) =>
    setCriteria((c) => ({ ...c, ...patch }))

  function clearFilters() {
    setCriteria((c) => ({
      ...DEFAULT_TRIP_LIST_CRITERIA,
      query: c.query,
      sortField: c.sortField,
      sortDir: c.sortDir,
    }))
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <SearchBar
        value={criteria.query}
        onChange={(q) => set({ query: q })}
        placeholder="Search trip name, city, companion"
      />
      <FilterToggleButton
        active={filtersOpen}
        onClick={() => setFiltersOpen((o) => !o)}
      />

      {filtersOpen && (
        <FilterPanel>
          <div className="grid grid-cols-2 gap-2">
            <SelectMenu
              value={criteria.country}
              onChange={(v) => set({ country: v })}
              ariaLabel="Country"
              options={[
                { value: 'all', label: 'Any Country' },
                ...countries.map((c) => ({ value: c, label: c })),
              ]}
            />
            <SelectMenu
              value={criteria.province}
              onChange={(v) => set({ province: v })}
              ariaLabel="Province"
              options={[
                { value: 'all', label: 'Any Province' },
                ...provinces.map((p) => ({ value: p, label: p })),
              ]}
            />
            <SelectMenu
              value={criteria.status}
              onChange={(v) => set({ status: v as TripListCriteria['status'] })}
              ariaLabel="Status"
              options={[
                { value: 'all', label: 'Any Status' },
                ...TRIP_STATUSES.map((s) => ({ value: s, label: tripStatusLabel(s) })),
              ]}
            />
            <SelectMenu
              value={String(criteria.minRating)}
              onChange={(v) => set({ minRating: Number(v) })}
              ariaLabel="Rating"
              options={RATING_OPTIONS}
            />
            <SelectMenu
              value={criteria.year}
              onChange={(v) => set({ year: v })}
              ariaLabel="Year"
              options={[
                { value: 'all', label: 'Any Year' },
                ...years.map((y) => ({ value: y, label: y })),
              ]}
            />
          </div>
          <div className="flex items-center justify-between">
            <SortControl
              field={criteria.sortField}
              options={SORT_OPTIONS}
              onFieldChange={(f) => set({ sortField: f })}
              dir={criteria.sortDir}
              onToggleDir={() =>
                set({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
              }
            />
            <button onClick={clearFilters} className="text-accent">
              Clear Filters
            </button>
          </div>
        </FilterPanel>
      )}

      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {error && <p className="p-4 text-sm text-danger">Couldn’t load your trips.</p>}

      {!loading && !error && trips.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <IconWorld size={40} className="text-text-tertiary" />
          <p className="text-sm text-text-secondary">No trips yet.</p>
          <PrimaryButton onClick={() => navigate(routes.travel.entry)}>
            New Trip
          </PrimaryButton>
        </div>
      )}

      {!loading && !error && trips.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          {view.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-secondary">
              No matches.
            </p>
          ) : (
            view.map((t) => {
              const label = primaryLabel(facetsByTrip.get(t.id))
              return (
                <SwipeRow key={t.id} onDelete={() => void remove(t.id, t.name)}>
                  <button
                    onClick={() => navigate(routes.travel.edit(t.id))}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
                  >
                    <Thumb url={t.cover_url} className="h-14 w-20 rounded-card" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] text-text-primary">
                          {t.name}
                        </span>
                        <StatusChip
                          label={tripStatusLabel(t.status)}
                          className={
                            TRIP_STATUS_CHIP[t.status as keyof typeof TRIP_STATUS_CHIP]
                          }
                        />
                      </div>
                      <p className="truncate text-xs text-text-secondary">
                        {dateRange(t.start_date, t.end_date)}
                        {label ? ` · ${label}` : ''}
                      </p>
                    </div>
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
