import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconRoute } from '@tabler/icons-react'
import { SelectMenu } from '../components/SelectMenu'
import { ListRow } from '../components/ListRow'
import { Thumb } from '../components/Thumb'
import { EmptyState } from '../components/EmptyState'
import { ListSearchFilterPanel, ResultCount } from '../components/ListSearchFilterPanel'
import { TravelRowHeader } from '../components/TravelRowHeader'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useSessionState } from '../hooks/useSessionState'
import { deleteTrip, listTripFacetRows, listTrips } from '../data/travel'
import { bumpTravel, useTravelVersion } from '../lib/travel-refresh'
import {
  DEFAULT_TRIP_CRITERIA,
  applyTripList,
  facetsForStops,
  primaryLabel,
  tripStatusLabel,
  tripYear,
  type TripFacets,
  type TripCriteria,
  type TripSortField,
} from '../lib/travel'
import { TRIP_STATUSES } from '../constants/travel'
import { routes } from '../constants/routes'

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

export function TravelTrips() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useTravelVersion()
  const [criteria, setCriteria] = useSessionState<TripCriteria>(
    'wellworth:travel-trips',
    DEFAULT_TRIP_CRITERIA,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)

  const fn = useCallback(() => {
    void version
    if (!userId) return Promise.resolve(null)
    return Promise.all([listTrips(userId), listTripFacetRows(userId)])
  }, [userId, version])
  const { data, loading, error } = useAsync(
    fn,
    undefined,
    userId ? { key: `travel:${userId}`, version } : undefined,
  )

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

  async function remove(id: string) {
    await deleteTrip(id)
    bumpTravel()
  }

  const set = (patch: Partial<TripCriteria>) => setCriteria((c) => ({ ...c, ...patch }))

  function clearFilters() {
    setCriteria(() => ({
      ...DEFAULT_TRIP_CRITERIA,
      //query: c.query,
      //sortField: c.sortField,
      //sortDir: c.sortDir,
    }))
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <ListSearchFilterPanel
        query={criteria.query}
        onQueryChange={(q) => set({ query: q })}
        placeholder="Search trip name, city, companion"
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        sortField={criteria.sortField}
        sortOptions={SORT_OPTIONS}
        onSortFieldChange={(f) => set({ sortField: f })}
        sortDir={criteria.sortDir}
        onToggleSortDir={() =>
          set({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
        }
        onClearFilters={clearFilters}
        hasActiveFilters={
          JSON.stringify(criteria) !== JSON.stringify(DEFAULT_TRIP_CRITERIA)
        }
        filters={
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
              onChange={(v) => set({ status: v as TripCriteria['status'] })}
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
        }
        loading={loading}
        error={error}
        data={data ? trips : undefined}
        errorText="Couldn’t load your trips."
        emptyState={
          <EmptyState
            title="No trips yet"
            actionLabel="New Trip"
            to={routes.travel.entry}
            Icon={IconRoute}
          />
        }
      >
        {(allTrips) => {
          const view = applyTripList(allTrips, facetsByTrip, criteria)
          return (
            <>
              {view.length > 0 && <ResultCount count={view.length} />}
              <div className="flex flex-col gap-2">
                {view.length === 0 ? (
                  <p className="rounded-card border border-border bg-surface px-4 py-6 text-center text-body text-text-secondary">
                    No matches.
                  </p>
                ) : (
                  view.map((t) => {
                    const label = primaryLabel(facetsByTrip.get(t.id))
                    return (
                      <ListRow
                        key={t.id}
                        leading={
                          <Thumb url={t.cover_url} className="h-14 w-20 rounded-card" />
                        }
                        onDelete={() => void remove(t.id)}
                        onClick={() => navigate(routes.travel.edit(t.id))}
                      >
                        <TravelRowHeader trip={t} label={label} />
                      </ListRow>
                    )
                  })
                )}
              </div>
            </>
          )
        }}
      </ListSearchFilterPanel>
    </div>
  )
}
