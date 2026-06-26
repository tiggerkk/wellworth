import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRIP_LIST_CRITERIA,
  TRIP_ENTRY_FIELDS,
  applyTripList,
  compareTripsByDateDesc,
  facetsForStops,
  isFieldVisible,
  primaryLabel,
  tripYear,
  type TripFacets,
  type TripListCriteria,
  type TripRow,
} from './travel'

function trip(p: Partial<TripRow>): TripRow {
  return {
    id: 'id',
    user_id: 'u',
    name: 'Trip',
    status: 'visited',
    base_currency: 'CNY',
    cover_url: null,
    companions: null,
    rating: null,
    notes: null,
    track_reimbursement: false,
    fx_rates: {},
    start_date: null,
    end_date: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...p,
  }
}

const crit = (p: Partial<TripListCriteria> = {}): TripListCriteria => ({
  ...DEFAULT_TRIP_LIST_CRITERIA,
  ...p,
})

describe('tripYear', () => {
  it('reads the year from start_date, null when undated', () => {
    expect(tripYear({ start_date: '2026-03-28' })).toBe('2026')
    expect(tripYear({ start_date: null })).toBeNull()
  })
})

describe('compareTripsByDateDesc', () => {
  it('sorts newest first and sinks undated trips', () => {
    const a = trip({ id: 'a', start_date: '2026-03-01' })
    const b = trip({ id: 'b', start_date: '2025-12-01' })
    const c = trip({ id: 'c', start_date: null })
    const sorted = [c, b, a].sort(compareTripsByDateDesc).map((t) => t.id)
    expect(sorted).toEqual(['a', 'b', 'c'])
  })
})

describe('facetsForStops / primaryLabel', () => {
  it('collects distinct cities/countries/provinces', () => {
    const f = facetsForStops([
      { city: '荆州', country: 'China', province: '湖北' },
      { city: '武汉', country: 'China', province: '湖北' },
      { city: null, country: null, province: null },
    ])
    expect([...f.cities]).toEqual(['荆州', '武汉'])
    expect([...f.countries]).toEqual(['China'])
    expect(primaryLabel(f)).toBe('湖北')
  })
  it('falls back to country when no province', () => {
    const f = facetsForStops([{ city: 'Paris', country: 'France', province: null }])
    expect(primaryLabel(f)).toBe('France')
  })
})

describe('applyTripList', () => {
  const a = trip({ id: 'a', name: 'Hubei', status: 'visited', start_date: '2026-03-28' })
  const b = trip({
    id: 'b',
    name: 'Zhaoqing',
    status: 'planning',
    start_date: '2026-01-30',
  })
  const facets = new Map<string, TripFacets>([
    ['a', facetsForStops([{ city: '荆州', country: 'China', province: '湖北' }])],
    ['b', facetsForStops([{ city: '肇庆', country: 'China', province: '广东' }])],
  ])

  it('returns all (reverse-chron) by default', () => {
    expect(applyTripList([a, b], facets, crit()).map((t) => t.id)).toEqual(['a', 'b'])
  })
  it('filters by status', () => {
    expect(
      applyTripList([a, b], facets, crit({ status: 'planning' })).map((t) => t.id),
    ).toEqual(['b'])
  })
  it('filters by province facet', () => {
    expect(
      applyTripList([a, b], facets, crit({ province: '湖北' })).map((t) => t.id),
    ).toEqual(['a'])
  })
  it('filters by year', () => {
    expect(
      applyTripList([a, b], facets, crit({ year: '2026' }))
        .map((t) => t.id)
        .sort(),
    ).toEqual(['a', 'b'])
  })
  it('searches by trip name and by city', () => {
    expect(
      applyTripList([a, b], facets, crit({ query: 'hube' })).map((t) => t.id),
    ).toEqual(['a'])
    expect(
      applyTripList([a, b], facets, crit({ query: '肇庆' })).map((t) => t.id),
    ).toEqual(['b'])
  })
  it('matches a Chinese city across Traditional/Simplified variants', () => {
    // city is stored Simplified ('肇庆'); a Traditional query ('肇慶') still finds it.
    expect(
      applyTripList([a, b], facets, crit({ query: '肇慶' })).map((t) => t.id),
    ).toEqual(['b'])
  })
  it('searches by companion', () => {
    const c = trip({ id: 'c', name: 'Solo', companions: 'Alice & Bob' })
    expect(
      applyTripList([a, b, c], facets, crit({ query: 'alice' })).map((t) => t.id),
    ).toEqual(['c'])
  })
  it('filters rating as a minimum', () => {
    const hi = trip({ id: 'a', name: 'Hubei', start_date: '2026-03-28', rating: 5 })
    const lo = trip({ id: 'b', name: 'Zhaoqing', start_date: '2026-01-30', rating: 3 })
    expect(
      applyTripList([hi, lo], facets, crit({ minRating: 4 })).map((t) => t.id),
    ).toEqual(['a'])
  })
  it('sorts by trip name ascending', () => {
    expect(
      applyTripList([a, b], facets, crit({ sortField: 'name', sortDir: 'asc' })).map(
        (t) => t.id,
      ),
    ).toEqual(['a', 'b'])
  })
  it('sorts by province (smallest facet) ascending', () => {
    expect(
      applyTripList([a, b], facets, crit({ sortField: 'province', sortDir: 'asc' })).map(
        (t) => t.id,
      ),
    ).toEqual(['b', 'a'])
  })
})

describe('TRIP_ENTRY_FIELDS / isFieldVisible', () => {
  it('lists the toggleable trip fields in form order', () => {
    expect(TRIP_ENTRY_FIELDS.map((f) => f.key)).toEqual([
      'rating',
      'cover_url',
      'companions',
      'track_reimbursement',
      'notes',
    ])
  })
  it('treats NULL prefs as all-visible (default-on)', () => {
    for (const f of TRIP_ENTRY_FIELDS) expect(isFieldVisible(null, f.key)).toBe(true)
  })
  it('respects an explicit visible list', () => {
    expect(isFieldVisible(['rating', 'notes'], 'rating')).toBe(true)
    expect(isFieldVisible(['rating', 'notes'], 'companions')).toBe(false)
  })
})
