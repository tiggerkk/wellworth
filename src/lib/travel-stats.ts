/**
 * Travel Dashboard derivations — pure, testable. Distinct place counts are taken **only over
 * `status = 'visited'` trips** (planning/want trips don't count as "places visited"). China-scoped
 * counts use `isChinaCountry`; the province count is intersected with `CHINA_PROVINCES` so "N / 34"
 * can never exceed the denominator even if a stray non-canonical province slips through.
 *
 * Monetary spend metrics (per-currency totals + the HKD equivalent) need the Expenses layer and land
 * in M5; here we only derive the count-based metrics (trips this year, days travelled).
 */
import { CHINA_PROVINCES } from '../constants/travel'
import { fromIsoDate } from './date'
import type { TripRow } from './travel'

/** The "/ 34" denominator for the province-progress line. */
export const CHINA_PROVINCE_TOTAL = CHINA_PROVINCES.length

const CANONICAL_PROVINCES = new Set<string>(CHINA_PROVINCES)

/** Index within `CHINA_PROVINCES` — municipalities, then provinces, then autonomous regions, then
 *  SARs, in that fixed group order (matching the const's own declaration order). Non-canonical
 *  names sort after all canonical ones. */
const PROVINCE_RANK = new Map<string, number>(CHINA_PROVINCES.map((p, i) => [p, i]))

/**
 * Comparator for China province names: municipalities, then provinces, then autonomous regions,
 * then special administrative regions — the grouping (and within-group order) `CHINA_PROVINCES`
 * is declared in. Any non-canonical name sorts after all canonical provinces, alphabetically.
 */
export function compareProvinces(a: string, b: string): number {
  const ra = PROVINCE_RANK.get(a)
  const rb = PROVINCE_RANK.get(b)
  if (ra != null && rb != null) return ra - rb
  if (ra != null) return -1
  if (rb != null) return 1
  return a.localeCompare(b, 'zh')
}

const CHINA_NAMES = new Set(['china', '中国', 'cn', 'prc', "people's republic of china"])

export function isChinaCountry(country: string | null): boolean {
  return country != null && CHINA_NAMES.has(country.trim().toLowerCase())
}

/** A stop's place fields tagged with its trip — the shape `listTripFacetRows` returns. */
export interface StatFacetRow {
  trip_id: string
  city: string | null
  country: string | null
  province: string | null
}

export interface TravelStats {
  chinaProvinces: number
  chinaCities: number
  countries: number
  cities: number
  tripsThisYear: number
  daysTravelled: number
}

/** Inclusive day span between two civil dates (>= 1). */
function daySpanInclusive(start: string, end: string): number {
  const ms = fromIsoDate(end).getTime() - fromIsoDate(start).getTime()
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

export function computeTravelStats(
  trips: TripRow[],
  facetRows: StatFacetRow[],
  thisYear: string,
): TravelStats {
  const visitedIds = new Set(trips.filter((t) => t.status === 'visited').map((t) => t.id))

  const provinces = new Set<string>()
  const chinaCities = new Set<string>()
  const countries = new Set<string>()
  const cities = new Set<string>()
  for (const r of facetRows) {
    if (!visitedIds.has(r.trip_id)) continue
    if (r.country) countries.add(r.country)
    if (r.city) cities.add(r.city)
    if (isChinaCountry(r.country)) {
      if (r.province && CANONICAL_PROVINCES.has(r.province)) provinces.add(r.province)
      if (r.city) chinaCities.add(r.city)
    }
  }

  const visited = trips.filter((t) => t.status === 'visited')
  const tripsThisYear = visited.filter(
    (t) => t.start_date?.slice(0, 4) === thisYear,
  ).length
  let daysTravelled = 0
  for (const t of visited) {
    if (t.start_date && t.end_date)
      daysTravelled += daySpanInclusive(t.start_date, t.end_date)
  }

  return {
    chinaProvinces: provinces.size,
    chinaCities: chinaCities.size,
    countries: countries.size,
    cities: cities.size,
    tripsThisYear,
    daysTravelled,
  }
}

export interface ProvinceVisitRow {
  province: string
  tripCount: number
}

export interface ProvinceVisitStats {
  /** Visited provinces, ordered by trip count desc, then province group order asc (see `compareProvinces`). */
  visited: ProvinceVisitRow[]
  /** Not-yet-visited provinces, in province group order (see `compareProvinces`). */
  unvisited: string[]
}

export interface CityVisitRow {
  province: string
  city: string
  tripCount: number
}

/**
 * Per-province visit counts for the Travel Dashboard's "中国省份" KPI drill-in. A province visited
 * more than once within the same trip (e.g. two stops) still counts as 1 trip for that province —
 * dedupe per trip before counting. Same `visited`-trips-only scoping as `computeTravelStats`.
 */
export function computeProvinceVisitStats(
  trips: TripRow[],
  facetRows: StatFacetRow[],
): ProvinceVisitStats {
  const visitedIds = new Set(trips.filter((t) => t.status === 'visited').map((t) => t.id))

  const provincesByTrip = new Map<string, Set<string>>()
  for (const r of facetRows) {
    if (!visitedIds.has(r.trip_id)) continue
    if (!isChinaCountry(r.country)) continue
    if (!r.province || !CANONICAL_PROVINCES.has(r.province)) continue
    const set = provincesByTrip.get(r.trip_id) ?? new Set<string>()
    set.add(r.province)
    provincesByTrip.set(r.trip_id, set)
  }

  const tripCounts = new Map<string, number>()
  for (const provinces of provincesByTrip.values()) {
    for (const province of provinces) {
      tripCounts.set(province, (tripCounts.get(province) ?? 0) + 1)
    }
  }

  const visited = Array.from(tripCounts.entries())
    .map(([province, tripCount]) => ({ province, tripCount }))
    .sort((a, b) => b.tripCount - a.tripCount || compareProvinces(a.province, b.province))

  // CHINA_PROVINCES is already in municipality/province/autonomous-region/SAR order, so filtering
  // preserves that order without a separate sort.
  const unvisited = CHINA_PROVINCES.filter((p) => !tripCounts.has(p))

  return { visited, unvisited }
}

/**
 * Per-city visit counts for the Travel Dashboard's "中国城市" KPI drill-in. A city visited more than
 * once within the same trip still counts as 1 trip for that city — dedupe per trip before counting.
 * Ordered by province group order (see `compareProvinces`) then city asc — a fixed display order,
 * independent of trip counts, so the overlay's layout doesn't reshuffle between opens.
 */
export function computeCityVisitStats(
  trips: TripRow[],
  facetRows: StatFacetRow[],
): CityVisitRow[] {
  const visitedIds = new Set(trips.filter((t) => t.status === 'visited').map((t) => t.id))

  const citiesByTrip = new Map<string, Set<string>>()
  const provinceForCity = new Map<string, string>()
  for (const r of facetRows) {
    if (!visitedIds.has(r.trip_id)) continue
    if (!isChinaCountry(r.country)) continue
    if (!r.city) continue
    const key = `${r.province ?? ''}\u0000${r.city}`
    const set = citiesByTrip.get(r.trip_id) ?? new Set<string>()
    set.add(key)
    citiesByTrip.set(r.trip_id, set)
    if (!provinceForCity.has(key)) provinceForCity.set(key, r.province ?? '')
  }

  const tripCounts = new Map<string, number>()
  for (const cities of citiesByTrip.values()) {
    for (const key of cities) {
      tripCounts.set(key, (tripCounts.get(key) ?? 0) + 1)
    }
  }

  return Array.from(tripCounts.entries())
    .map(([key, tripCount]) => {
      const [, city] = key.split('\u0000')
      return { province: provinceForCity.get(key) ?? '', city: city ?? '', tripCount }
    })
    .sort(
      (a, b) =>
        compareProvinces(a.province, b.province) || a.city.localeCompare(b.city, 'zh'),
    )
}
