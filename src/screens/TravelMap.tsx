import { Suspense, useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconRoute, IconX } from '@tabler/icons-react'
import { Toggle } from '../components/Toggle'
import { EmptyState } from '../components/EmptyState'
import { StatusChip } from '../components/StatusChip'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { lazyWithReload } from '../lib/lazy-with-reload'
import { listRememberedCities, listTripFacetRows, listTrips } from '../data/travel'
import { useTravelVersion } from '../lib/travel-refresh'
import { TRIP_STATUS_CHIP, tripStatusLabel, type TripRow } from '../lib/travel'
import { isChinaCountry, type StatFacetRow } from '../lib/travel-stats'
import type { MapCity } from '../components/TravelMapCanvas'
import { routes } from '../constants/routes'

const TravelMapCanvas = lazyWithReload(() =>
  import('../components/TravelMapCanvas').then((m) => ({ default: m.TravelMapCanvas })),
)

const norm = (s: string) => s.trim().toLowerCase()

export function TravelMap() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useTravelVersion()
  const [showFill, setShowFill] = useState(true)
  const [selected, setSelected] = useState<MapCity | null>(null)

  const fn = useCallback(() => {
    void version
    if (!userId)
      return Promise.resolve<
        [TripRow[], StatFacetRow[], Awaited<ReturnType<typeof listRememberedCities>>]
      >([[], [], []])
    return Promise.all([
      listTrips(userId),
      listTripFacetRows(userId),
      listRememberedCities(userId),
    ])
  }, [userId, version])
  const { data, loading, error } = useAsync(fn)

  const [trips, facetRows, remembered] = data ?? [[], [], []]

  const { cities, visitedProvinces, visitedCountries } = useMemo(() => {
    const tripById = new Map(trips.map((t) => [t.id, t]))
    const coordsByNorm = new Map<string, { city: string; lat: number; lng: number }>()
    for (const c of remembered) {
      if (c.lat != null && c.lng != null) {
        coordsByNorm.set(norm(c.city), { city: c.city, lat: c.lat, lng: c.lng })
      }
    }

    const cityMap = new Map<string, MapCity>()
    const provinces = new Set<string>()
    const countries = new Set<string>()
    for (const r of facetRows) {
      const trip = tripById.get(r.trip_id)
      if (!trip) continue
      const visited = trip.status === 'visited'
      if (visited && r.country) {
        if (isChinaCountry(r.country)) {
          if (r.province) provinces.add(r.province)
        } else {
          countries.add(r.country)
        }
      }
      if (!r.city) continue
      const co = coordsByNorm.get(norm(r.city))
      if (!co) continue
      const key = norm(r.city)
      let e = cityMap.get(key)
      if (!e) {
        e = { key, city: co.city, lat: co.lat, lng: co.lng, anyVisited: false, trips: [] }
        cityMap.set(key, e)
      }
      if (!e.trips.some((t) => t.id === trip.id)) {
        e.trips.push({ id: trip.id, name: trip.name, status: trip.status })
      }
      if (visited) e.anyVisited = true
    }

    return {
      cities: [...cityMap.values()],
      visitedProvinces: [...provinces],
      visitedCountries: [...countries],
    }
  }, [trips, facetRows, remembered])

  function selectCity(city: MapCity) {
    if (city.trips.length === 1) {
      navigate(routes.travel.edit(city.trips[0]!.id))
    } else {
      setSelected(city)
    }
  }

  if (loading) return <p className="p-4 text-body text-text-secondary">Loading…</p>
  if (error) return <p className="p-4 text-body text-danger">Couldn’t load the map.</p>

  if (trips.length === 0) {
    return (
      <div className="flex min-h-full flex-col">
        <EmptyState
          title="No trips yet"
          actionLabel="New Trip"
          to={routes.travel.entry}
          Icon={IconRoute}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3 text-section text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <Dot color="#e8623c" /> Visited
          </span>
          <span className="inline-flex items-center gap-1">
            <Dot color="#9aa3b5" /> Planned
          </span>
        </div>
        <label className="flex items-center gap-2 text-caption text-text-secondary">
          Region fill
          <Toggle checked={showFill} onChange={setShowFill} label="Region fill" />
        </label>
      </div>

      <div className="relative flex-1">
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-body text-text-secondary">
              Loading map…
            </div>
          }
        >
          <TravelMapCanvas
            cities={cities}
            visitedProvinces={visitedProvinces}
            visitedCountries={visitedCountries}
            showFill={showFill}
            onSelectCity={selectCity}
          />
        </Suspense>

        {cities.length === 0 && (
          <div className="pointer-events-none absolute inset-x-4 top-3 z-[1100] rounded-card border border-border bg-surface/90 px-3 py-2 text-center text-caption text-text-secondary">
            No mapped cities yet — add coordinates via the city picker’s “Look up online”.
          </div>
        )}

        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-[1100] overflow-hidden rounded-card border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-body font-medium text-text-primary">
                {selected.city}
              </span>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="text-text-secondary"
              >
                <IconX size={18} />
              </button>
            </div>
            {selected.trips.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(routes.travel.edit(t.id))}
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left last:border-b-0 active:bg-input/40"
              >
                <span className="flex-1 truncate text-body text-text-primary">
                  {t.name}
                </span>
                <StatusChip
                  label={tripStatusLabel(t.status)}
                  className={TRIP_STATUS_CHIP[t.status as keyof typeof TRIP_STATUS_CHIP]}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  )
}
