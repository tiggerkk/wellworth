/**
 * Travel domain logic — type aliases for the generated DB rows plus pure, testable helpers (status
 * palette, trip-list filter/sort, per-type field rules, display formatting). Side-effectful DB access
 * lives in `src/data/travel.ts`; enums + labels live in `src/constants/travel.ts`.
 */
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'
import {
  STOP_TYPE_LABELS,
  TRIP_STATUSES,
  TRIP_STATUS_LABELS,
  type StopType,
  type TripStatus,
} from '../constants/travel'
import { foldZh } from './zh-fold'

export type TripRow = Tables<'trip'>
export type TripInsert = TablesInsert<'trip'>
export type TripUpdate = TablesUpdate<'trip'>
export type TripDayRow = Tables<'trip_day'>
export type TripDayInsert = TablesInsert<'trip_day'>
export type TripDayUpdate = TablesUpdate<'trip_day'>
export type StopRow = Tables<'stop'>
export type StopInsert = TablesInsert<'stop'>
export type StopUpdate = TablesUpdate<'stop'>
export type RememberedCityRow = Tables<'remembered_city'>
export type RememberedCityInsert = TablesInsert<'remembered_city'>

/** Trip + its ordered days + all stops (grouped by day in the UI). Returned by `getTripBundle`. */
export interface TripBundle {
  trip: TripRow
  days: TripDayRow[]
  stops: StopRow[]
}

/** A city resolved by the picker (manual, cache, or geocode assist) — handed back to a stop. */
export interface ResolvedCity {
  city: string
  country: string
  province: string | null
  lat: number | null
  lng: number | null
}

// --- Status palette (mirrors Shows/Books `*_STATUS_CHIP`) ---

// want = purple (planned), planning = orange (active/in-progress), visited = teal (done) —
// matches Shows/Books `*_STATUS_CHIP`.
export const TRIP_STATUS_CHIP: Record<TripStatus, string> = {
  want: 'bg-plan text-bg',
  planning: 'bg-warning text-bg',
  visited: 'bg-positive text-bg',
}

export function tripStatusLabel(status: string): string {
  return TRIP_STATUS_LABELS[status as TripStatus] ?? status
}

export function stopTypeLabel(type: string): string {
  return STOP_TYPE_LABELS[type as StopType] ?? type
}

// --- Trip-list view (search + filters + sort) ---

export type TripSortField = 'date' | 'country' | 'province' | 'city' | 'status' | 'name'
export type TripSortDir = 'asc' | 'desc'

export interface TripListCriteria {
  query: string
  status: 'all' | TripStatus
  country: 'all' | string
  province: 'all' | string
  year: 'all' | string
  minRating: number // 0 = any
  sortField: TripSortField
  sortDir: TripSortDir
}

export const DEFAULT_TRIP_LIST_CRITERIA: TripListCriteria = {
  query: '',
  status: 'all',
  country: 'all',
  province: 'all',
  year: 'all',
  minRating: 0,
  sortField: 'date',
  sortDir: 'desc',
}

/** The year of a trip from its cached start_date (or null while undated). */
export function tripYear(trip: Pick<TripRow, 'start_date'>): string | null {
  return trip.start_date ? trip.start_date.slice(0, 4) : null
}

/**
 * Filter + reverse-chronological sort for the Trips list. `stopsByTrip` (country/province/city sets,
 * built from the loaded stops) lets the country/province filters + the city search match itinerary
 * content, not just the trip name. Trips with no start_date sort last.
 */
export interface TripFacets {
  countries: Set<string>
  provinces: Set<string>
  cities: Set<string>
}

export function applyTripList(
  trips: TripRow[],
  facetsByTrip: Map<string, TripFacets>,
  c: TripListCriteria,
): TripRow[] {
  // foldZh lowercases + normalizes Chinese variant, so name/city/companion search is
  // Traditional⇄Simplified agnostic (see src/lib/zh-fold.ts).
  const q = foldZh(c.query.trim())
  return trips
    .filter((t) => {
      const f = facetsByTrip.get(t.id)
      if (c.status !== 'all' && t.status !== c.status) return false
      if (c.country !== 'all' && !f?.countries.has(c.country)) return false
      if (c.province !== 'all' && !f?.provinces.has(c.province)) return false
      if (c.year !== 'all' && tripYear(t) !== c.year) return false
      if (c.minRating > 0 && (t.rating ?? 0) < c.minRating) return false
      if (q) {
        const inName = foldZh(t.name).includes(q)
        const inCity = [...(f?.cities ?? [])].some((city) => foldZh(city).includes(q))
        const inCompanion = foldZh(t.companions ?? '').includes(q)
        if (!inName && !inCity && !inCompanion) return false
      }
      return true
    })
    .sort((a, b) => compareTrips(a, b, facetsByTrip, c.sortField, c.sortDir))
}

/** Alphabetically smallest non-empty value of a facet set (drives country/province/city sort). */
function minFacet(set: Set<string> | undefined): string | null {
  let min: string | null = null
  for (const v of set ?? []) if (v && (min == null || v.localeCompare(min) < 0)) min = v
  return min
}

function tripSortKey(
  t: TripRow,
  facetsByTrip: Map<string, TripFacets>,
  field: TripSortField,
): string | number | null {
  switch (field) {
    case 'date':
      return t.start_date
    case 'country':
      return minFacet(facetsByTrip.get(t.id)?.countries)
    case 'province':
      return minFacet(facetsByTrip.get(t.id)?.provinces)
    case 'city':
      return minFacet(facetsByTrip.get(t.id)?.cities)
    case 'status': {
      const i = TRIP_STATUSES.indexOf(t.status as TripStatus)
      return i >= 0 ? i : 99
    }
    case 'name':
      return t.name.toLowerCase()
  }
}

function compareTrips(
  a: TripRow,
  b: TripRow,
  facetsByTrip: Map<string, TripFacets>,
  field: TripSortField,
  dir: TripSortDir,
): number {
  const ka = tripSortKey(a, facetsByTrip, field)
  const kb = tripSortKey(b, facetsByTrip, field)
  // Reverse-chronological as the secondary order (and when a key is missing).
  const byDate = compareTripsByDateDesc(a, b)
  if (ka == null && kb == null) return byDate
  if (ka == null) return 1
  if (kb == null) return -1
  const primary =
    typeof ka === 'number' && typeof kb === 'number'
      ? ka - kb
      : String(ka).localeCompare(String(kb))
  if (primary !== 0) return dir === 'asc' ? primary : -primary
  return byDate
}

/** Reverse-chronological by start_date; undated trips sink to the bottom, then newest-touched first. */
export function compareTripsByDateDesc(a: TripRow, b: TripRow): number {
  if (a.start_date && b.start_date) {
    if (a.start_date !== b.start_date) return b.start_date.localeCompare(a.start_date)
  } else if (a.start_date) {
    return -1
  } else if (b.start_date) {
    return 1
  }
  return (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
}

// --- Display helpers ---

/** A trip's primary country/province for a list row: the most-common across its stops (else null). */
export function primaryLabel(facets: TripFacets | undefined): string | null {
  if (!facets) return null
  const province = mostCommon(facets.provinces)
  if (province) return province
  return mostCommon(facets.countries)
}

function mostCommon(set: Set<string>): string | null {
  // Sets here are already de-duplicated; "most common" degrades to "first non-empty".
  for (const v of set) if (v) return v
  return null
}

/** Build per-trip facet sets from the loaded days+stops of a bundle list. */
export function facetsForStops(
  stops: Pick<StopRow, 'city' | 'country' | 'province'>[],
): TripFacets {
  const f: TripFacets = { countries: new Set(), provinces: new Set(), cities: new Set() }
  for (const s of stops) {
    if (s.country) f.countries.add(s.country)
    if (s.province) f.provinces.add(s.province)
    if (s.city) f.cities.add(s.city)
  }
  return f
}

// --- Entry/Edit field visibility (Travel Settings; mirrors Shows/Books/Quotes/Medical) ---

/**
 * The Trip-form fields the owner can hide from Travel Settings, in form order. Trip Name, Base
 * Currency and Status are required and always shown (not listed here). Stored on
 * `profile.travel_visible_fields` (NULL = all visible).
 */
export const TRIP_ENTRY_FIELDS: { key: string; label: string }[] = [
  { key: 'rating', label: 'Rating' },
  { key: 'cover_url', label: 'Cover Image URL' },
  { key: 'companions', label: 'Companions' },
  { key: 'track_reimbursement', label: 'Track Reimbursement' },
  { key: 'notes', label: 'Notes' },
]

/** Whether a Trip-form field is visible. NULL stored prefs (or an unknown key) ⇒ visible (default-on). */
export function isFieldVisible(visibleFields: string[] | null, key: string): boolean {
  return visibleFields == null || visibleFields.includes(key)
}
