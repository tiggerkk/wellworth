import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconMapPin, IconUpload, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { PrimaryButton } from '../components/PrimaryButton'
import { SectionCard } from '../components/SectionCard'
import { StatusChip } from '../components/StatusChip'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import {
  createDay,
  createStop,
  createTrip,
  listRememberedCities,
  recomputeTripDates,
  rememberCity,
} from '../data/travel'
import { bumpTravel } from '../lib/travel-refresh'
import { errorMessage } from '../lib/errors'
import { geocodeCity } from '../lib/places'
import { TRIP_STATUS_CHIP, tripStatusLabel } from '../lib/travel'
import {
  distinctCities,
  parseItineraryJson,
  tripSummary,
  type DistinctCity,
  type TripDraft,
} from '../lib/itinerary-import'
import { STOP_TYPE_LABELS, type StopType } from '../constants/travel'

const norm = (s: string) => s.trim().toLowerCase()

interface Pending {
  lat: number | null
  lng: number | null
  province: string | null
}

export function ImportTravelTripsSheet() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [trips, setTrips] = useState<TripDraft[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, Pending>>({})
  const [geocoding, setGeocoding] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<{ trips: number; days: number; stops: number } | null>(
    null,
  )

  const loadCache = useCallback(() => {
    if (!userId)
      return Promise.resolve([] as Awaited<ReturnType<typeof listRememberedCities>>)
    return listRememberedCities(userId)
  }, [userId])
  const { data: cache } = useAsync(loadCache)

  const cacheNorms = useMemo(
    () => new Set((cache ?? []).map((c) => norm(c.city))),
    [cache],
  )
  const newCities = useMemo<DistinctCity[]>(
    () =>
      trips ? distinctCities(trips).filter((c) => !cacheNorms.has(norm(c.city))) : [],
    [trips, cacheNorms],
  )

  const totals = useMemo(() => {
    if (!trips) return { days: 0, stops: 0 }
    let days = 0
    let stops = 0
    for (const t of trips) {
      days += t.days.length
      for (const d of t.days) stops += d.stops.length
    }
    return { days, stops }
  }, [trips])

  async function onFile(file: File) {
    setError(null)
    setDone(null)
    setPending({})
    const result = parseItineraryJson(await file.text())
    setFileName(file.name)
    if (result.ok) {
      setTrips(result.trips)
      setWarnings(result.warnings)
    } else {
      setTrips(null)
      setWarnings([])
      setError(result.error)
    }
  }

  async function lookUp(city: DistinctCity) {
    setGeocoding(norm(city.city))
    try {
      const [hit] = await geocodeCity(city.city)
      if (hit) {
        setPending((p) => ({
          ...p,
          [norm(city.city)]: {
            lat: hit.lat,
            lng: hit.lng,
            province: city.province ?? hit.province,
          },
        }))
      }
    } finally {
      setGeocoding(null)
    }
  }

  async function runImport() {
    if (!userId || !trips || trips.length === 0) return
    setImporting(true)
    setError(null)
    try {
      // Cache new cities first (country/province from the JSON, coords from any look-up).
      for (const c of newCities) {
        const p = pending[norm(c.city)]
        await rememberCity(userId, {
          city: c.city,
          country: c.country ?? '',
          province: p?.province ?? c.province,
          lat: p?.lat ?? null,
          lng: p?.lng ?? null,
        })
      }

      for (const t of trips) {
        const trip = await createTrip({
          user_id: userId,
          name: t.name,
          status: t.status,
          base_currency: t.base_currency,
        })
        for (let di = 0; di < t.days.length; di++) {
          const d = t.days[di]!
          const day = await createDay({
            user_id: userId,
            trip_id: trip.id,
            day_date: d.date,
            sort_order: di,
          })
          for (let si = 0; si < d.stops.length; si++) {
            const s = d.stops[si]!
            await createStop({
              user_id: userId,
              trip_day_id: day.id,
              type: s.type,
              city: s.city,
              country: s.country,
              province: s.province,
              description: s.description,
              details: s.details,
              completion: s.completion,
              sort_order: si,
            })
          }
        }
        await recomputeTripDates(trip.id)
      }
      bumpTravel()
      setDone({ trips: trips.length, days: totals.days, stops: totals.stops })
    } catch (e) {
      setError(errorMessage(e, 'Import failed.'))
    } finally {
      setImporting(false)
    }
  }

  const tripCount = trips?.length ?? 0

  return (
    <Sheet variant="full" label="Import Trips">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Import Trips</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {done !== null ? (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-medium text-text-primary">
              Imported {done.trips} trip{done.trips === 1 ? '' : 's'} ({done.days} days,{' '}
              {done.stops} stops).
            </p>
            <p className="text-sm text-text-secondary">
              They’re drafts — finish them in the Trip Builder. Expenses import
              separately.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Upload a JSON array of trips (see{' '}
              <code className="text-text-primary">
                templates/travel-itinerary-prompt.md
              </code>
              ). It’s a one-time back-catalogue load — the result is drafts you finish in
              the Trip Builder.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-input border border-border bg-input px-4 py-3 text-[15px] text-text-primary"
            >
              <IconUpload size={18} />
              {fileName ? 'Choose a different file' : 'Choose JSON File'}
            </button>
            {fileName && (
              <p className="text-xs text-text-secondary">
                Selected: <span className="text-text-primary">{fileName}</span>
              </p>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}

            {trips && (
              <>
                <div className="rounded-card border border-border bg-surface px-4 py-3 text-sm text-text-primary">
                  Ready to import <strong>{tripCount}</strong> trip
                  {tripCount === 1 ? '' : 's'} — {totals.days} days, {totals.stops} stops.
                </div>

                <SectionCard title="Trips">
                  {trips.map((t, i) => {
                    const s = tripSummary(t)
                    const types = (Object.entries(s.byType) as [StopType, number][])
                      .map(([k, n]) => `${n} ${STOP_TYPE_LABELS[k].toLowerCase()}`)
                      .join(' · ')
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[15px] text-text-primary">
                              {t.name}
                            </span>
                            <StatusChip
                              label={tripStatusLabel(t.status)}
                              className={TRIP_STATUS_CHIP[t.status]}
                            />
                          </div>
                          <p className="truncate text-xs text-text-secondary">
                            {s.days} days · {s.stops} stops{types ? ` · ${types}` : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </SectionCard>

                {newCities.length > 0 && (
                  <SectionCard title={`New cities (${newCities.length})`}>
                    {newCities.map((c) => {
                      const p = pending[norm(c.city)]
                      const prov = p?.province ?? c.province
                      return (
                        <div
                          key={c.city}
                          className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
                        >
                          <IconMapPin size={16} className="shrink-0 text-text-tertiary" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-text-primary">
                              {c.city}
                            </div>
                            <div className="truncate text-xs text-text-secondary">
                              {[prov, c.country].filter(Boolean).join(' · ') ||
                                'unresolved'}
                              {p?.lat != null && ' · pinned'}
                            </div>
                          </div>
                          <button
                            onClick={() => void lookUp(c)}
                            disabled={geocoding === norm(c.city)}
                            className="shrink-0 rounded-pill bg-input px-2.5 py-1 text-xs font-medium text-accent disabled:opacity-50"
                          >
                            {geocoding === norm(c.city) ? '…' : 'Look up'}
                          </button>
                        </div>
                      )
                    })}
                  </SectionCard>
                )}

                {warnings.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-warning">
                      {warnings.length} note{warnings.length === 1 ? '' : 's'}:
                    </p>
                    <ul className="flex flex-col gap-1 text-xs text-text-secondary">
                      {warnings.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {done !== null ? (
          <PrimaryButton onClick={() => navigate(-1)} className="w-full">
            DONE
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={() => void runImport()}
            disabled={importing || tripCount === 0}
            className="w-full"
          >
            {importing
              ? 'Importing…'
              : tripCount > 0
                ? `IMPORT ${tripCount} TRIP${tripCount === 1 ? '' : 'S'}`
                : 'IMPORT'}
          </PrimaryButton>
        )}
      </div>
    </Sheet>
  )
}
