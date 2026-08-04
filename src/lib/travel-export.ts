/**
 * Pure JSON-building for the Trips export — the inverse of `travel-import.ts`'s
 * `parseTravelJson`. Produces the same shape as `templates/travel.schema.json` (an array of
 * trips), so a file produced here re-imports unchanged via Import JSON Trips.
 *
 * A day's `label` (free text set in Edit Trip) has no place in the import schema
 * (`additionalProperties: false` there) and isn't restored by re-import — a known gap for a
 * truncate/restore round-trip, since the importer only ever reads a day's `date` and `stops`.
 *
 * Trips are sorted by the date of their first stop, descending (most recent first) — the date of
 * the earliest day (by `sort_order`) that has at least one stop; a trip with no dated first stop
 * sorts last regardless. No I/O.
 */
import type { TripExportBundle } from './travel'

export interface TripExportDay {
  date: string | null
  stops: TripExportStop[]
}

export interface TripExportStop {
  type: string
  description: string | null
  city: string | null
  country: string | null
  province: string | null
  details: string | null
  completion: string | null
}

export interface TripExportRecord {
  trip_name: string
  status: string
  base_currency: string
  companions: string | null
  rating: number | null
  notes: string | null
  url: string | null
  days: TripExportDay[]
}

/** The date of the earliest day (by array order) that has ≥1 stop, or null if none do. */
function firstStopDate(bundle: TripExportBundle): string | null {
  for (const { day, stops } of bundle.days) {
    if (stops.length > 0) return day.day_date
  }
  return null
}

/** Descending by first-stop date; a trip with no dated first stop always sorts last. */
function compareDates(da: string | null, db: string | null): number {
  if (da == null && db == null) return 0
  if (da == null) return 1
  if (db == null) return -1
  return db.localeCompare(da)
}

export function buildTripsExportData(bundles: TripExportBundle[]): TripExportRecord[] {
  // Compute each bundle's sort key once (not inside the comparator, which the sort calls
  // O(n log n) times) — a decorate/sort/undecorate pass.
  const sorted = bundles
    .map((bundle) => ({ bundle, key: firstStopDate(bundle) }))
    .sort((a, b) => compareDates(a.key, b.key))
    .map(({ bundle }) => bundle)

  return sorted.map(({ trip, days }) => ({
    trip_name: trip.name,
    status: trip.status,
    base_currency: trip.base_currency,
    companions: trip.companions,
    rating: trip.rating,
    notes: trip.notes,
    url: trip.cover_url,
    days: days.map(({ day, stops }) => ({
      date: day.day_date,
      stops: stops.map((s) => ({
        type: s.type,
        description: s.description,
        city: s.city,
        country: s.country,
        province: s.province,
        details: s.details,
        completion: s.completion,
      })),
    })),
  }))
}
