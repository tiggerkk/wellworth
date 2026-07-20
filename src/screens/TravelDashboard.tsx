import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { IconRoute } from '@tabler/icons-react'
import { SectionCard } from '../components/SectionCard'
import { DashboardRow } from '../components/DashboardRow'
import { TravelRowHeader } from '../components/TravelRowHeader'
import { Thumb } from '../components/Thumb'
import { EmptyState } from '../components/EmptyState'
import { ListLoader } from '../components/ListLoader'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { fromDashboard } from '../hooks/useEntryClose'
import { listTripFacetRows, listTrips } from '../data/travel'
import { useTravelVersion } from '../lib/travel-refresh'
import {
  compareTripsByDateDesc,
  facetsForStops,
  primaryLabel,
  type TripFacets,
  type TripRow,
} from '../lib/travel'
import {
  CHINA_PROVINCE_TOTAL,
  computeTravelStats,
  type StatFacetRow,
} from '../lib/travel-stats'
import { routes } from '../constants/routes'
import { todayLocal } from '../lib/date'

const RECENT_LIMIT = 5
const SHELF_LIMIT = 4

export function TravelDashboard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useTravelVersion()

  const fn = useCallback(() => {
    void version
    if (!userId) return Promise.resolve<[TripRow[], StatFacetRow[]]>([[], []])
    return Promise.all([listTrips(userId), listTripFacetRows(userId)])
  }, [userId, version])
  const { data, loading, error } = useAsync(fn)

  const [trips, facetRows] = data ?? [[], []]

  const facetsByTrip = useMemo(() => {
    const grouped = new Map<string, StatFacetRow[]>()
    for (const r of facetRows) {
      const arr = grouped.get(r.trip_id) ?? []
      arr.push(r)
      grouped.set(r.trip_id, arr)
    }
    const byTrip = new Map<string, TripFacets>()
    for (const [tripId, rows] of grouped) byTrip.set(tripId, facetsForStops(rows))
    return byTrip
  }, [facetRows])

  const stats = useMemo(
    () => computeTravelStats(trips, facetRows, todayLocal().slice(0, 4)),
    [trips, facetRows],
  )

  const recentlyVisited = useMemo(
    () =>
      trips
        .filter((t) => t.status === 'visited')
        .sort(compareTripsByDateDesc)
        .slice(0, RECENT_LIMIT),
    [trips],
  )
  const planning = useMemo(
    () => trips.filter((t) => t.status === 'planning').slice(0, SHELF_LIMIT),
    [trips],
  )
  const want = useMemo(
    () => trips.filter((t) => t.status === 'want').slice(0, SHELF_LIMIT),
    [trips],
  )

  return (
    <ListLoader
      loading={loading}
      error={error}
      data={data ? trips : undefined}
      errorText="Couldn’t load your travel dashboard."
      emptyState={
        <div className="flex min-h-full flex-col">
          <EmptyState
            title="No trips yet"
            actionLabel="New Trip"
            to={routes.travel.entry}
            Icon={IconRoute}
          />
        </div>
      }
    >
      {() => (
        <div className="flex flex-col gap-4 px-4 py-4 pb-8">
          {/* Count tiles — 3 columns × 2 rows, filled column-first (China · World · Trips). */}
          <div className="grid grid-flow-col grid-cols-3 grid-rows-2 gap-2">
            <Tile
              value={stats.chinaProvinces}
              suffix={`/ ${CHINA_PROVINCE_TOTAL}`}
              label="中国省份"
            />
            <Tile value={stats.chinaCities} label="中国城市" />
            <Tile value={stats.countries} label="Countries" />
            <Tile value={stats.cities} label="Cities" />
            <Tile value={stats.tripsThisYear} label="Trips This Year" />
            <Tile value={stats.daysTravelled} label="Days Travelled" />
          </div>

          <Shelf
            title="Recently Visited"
            trips={recentlyVisited}
            facetsByTrip={facetsByTrip}
            onOpen={(id) => navigate(routes.travel.edit(id), fromDashboard)}
            onSeeAll={() => navigate(routes.travel.trips)}
          />
          <Shelf
            title="Planning"
            trips={planning}
            facetsByTrip={facetsByTrip}
            onOpen={(id) => navigate(routes.travel.edit(id), fromDashboard)}
          />
          <Shelf
            title="Want to Visit"
            trips={want}
            facetsByTrip={facetsByTrip}
            onOpen={(id) => navigate(routes.travel.edit(id), fromDashboard)}
          />
        </div>
      )}
    </ListLoader>
  )
}

function Tile({
  value,
  suffix,
  label,
}: {
  value: number
  suffix?: string
  label: string
}) {
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-3">
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-semibold text-text-primary">{value}</span>
        {suffix && <span className="text-caption text-text-secondary">{suffix}</span>}
      </div>
      <p className="mt-0.5 text-caption leading-tight text-text-secondary">{label}</p>
    </div>
  )
}

function Shelf({
  title,
  trips,
  facetsByTrip,
  onOpen,
  onSeeAll,
}: {
  title: string
  trips: TripRow[]
  facetsByTrip: Map<string, TripFacets>
  onOpen: (id: string) => void
  onSeeAll?: () => void
}) {
  if (trips.length === 0) return null
  return (
    <SectionCard title={title}>
      {trips.map((t) => {
        const label = primaryLabel(facetsByTrip.get(t.id))
        return (
          <DashboardRow
            key={t.id}
            leading={<Thumb url={t.cover_url} className="h-12 w-16 rounded-card" />}
            onClick={() => onOpen(t.id)}
          >
            <TravelRowHeader trip={t} label={label} />
          </DashboardRow>
        )
      })}
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="w-full px-3 py-2.5 text-left text-body text-accent active:bg-input/40"
        >
          See all trips
        </button>
      )}
    </SectionCard>
  )
}
