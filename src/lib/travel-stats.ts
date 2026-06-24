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
