import { describe, expect, it } from 'vitest'
import { buildTripsExportData } from './travel-export'
import type { StopRow, TripDayRow, TripExportBundle, TripRow } from './travel'

function makeTrip(overrides: Partial<TripRow> = {}): TripRow {
  return {
    id: 't1',
    user_id: 'u1',
    name: 'Trip Name',
    status: 'visited',
    base_currency: 'CNY',
    companions: null,
    rating: null,
    notes: null,
    cover_url: null,
    start_date: null,
    end_date: null,
    fx_rates: {},
    track_reimbursement: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDay(overrides: Partial<TripDayRow> = {}): TripDayRow {
  return {
    id: 'd1',
    trip_id: 't1',
    user_id: 'u1',
    day_date: '2026-01-01',
    label: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeStop(overrides: Partial<StopRow> = {}): StopRow {
  return {
    id: 's1',
    trip_day_id: 'd1',
    user_id: 'u1',
    type: 'visit',
    description: 'A place',
    city: 'Beijing',
    country: 'China',
    province: null,
    details: null,
    completion: 'done',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeBundle(overrides: Partial<TripExportBundle> = {}): TripExportBundle {
  return {
    trip: makeTrip(),
    days: [{ day: makeDay(), stops: [makeStop()] }],
    ...overrides,
  }
}

describe('buildTripsExportData', () => {
  it('maps trip fields to the import schema field names', () => {
    const [record] = buildTripsExportData([
      makeBundle({
        trip: makeTrip({
          name: 'Hubei',
          status: 'visited',
          base_currency: 'CNY',
          companions: 'Ady',
          rating: 4.5,
          notes: 'Great trip',
          cover_url: 'https://example.com/cover.jpg',
        }),
      }),
    ])
    expect(record).toMatchObject({
      trip_name: 'Hubei',
      status: 'visited',
      base_currency: 'CNY',
      companions: 'Ady',
      rating: 4.5,
      notes: 'Great trip',
      url: 'https://example.com/cover.jpg',
    })
  })

  it('maps each day to {date, stops} and each stop to the schema fields', () => {
    const records = buildTripsExportData([
      makeBundle({
        days: [
          {
            day: makeDay({ day_date: '2026-03-28' }),
            stops: [
              makeStop({
                type: 'travel',
                description: 'HK-Shenzhen',
                city: 'Shenzhen',
                country: 'China',
                province: 'Guangdong',
                details: 'note',
                completion: 'done',
              }),
            ],
          },
        ],
      }),
    ])
    expect(records[0]?.days).toEqual([
      {
        date: '2026-03-28',
        stops: [
          {
            type: 'travel',
            description: 'HK-Shenzhen',
            city: 'Shenzhen',
            country: 'China',
            province: 'Guangdong',
            details: 'note',
            completion: 'done',
          },
        ],
      },
    ])
  })

  it('does not include a day label in the exported day', () => {
    const records = buildTripsExportData([
      makeBundle({
        days: [{ day: makeDay({ label: 'Day 1: Arrival' }), stops: [makeStop()] }],
      }),
    ])
    expect(records[0]?.days[0]).not.toHaveProperty('label')
  })

  it('sorts trips by the date of their first stop, descending', () => {
    const records = buildTripsExportData([
      makeBundle({
        trip: makeTrip({ id: 'a', name: 'Middle' }),
        days: [{ day: makeDay({ day_date: '2026-02-01' }), stops: [makeStop()] }],
      }),
      makeBundle({
        trip: makeTrip({ id: 'b', name: 'Latest' }),
        days: [{ day: makeDay({ day_date: '2026-03-01' }), stops: [makeStop()] }],
      }),
      makeBundle({
        trip: makeTrip({ id: 'c', name: 'Earliest' }),
        days: [{ day: makeDay({ day_date: '2026-01-01' }), stops: [makeStop()] }],
      }),
    ])
    expect(records.map((r) => r.trip_name)).toEqual(['Latest', 'Middle', 'Earliest'])
  })

  it('uses the date of the first day that actually has a stop, skipping empty leading days', () => {
    const records = buildTripsExportData([
      makeBundle({
        trip: makeTrip({ id: 'a', name: 'Has empty first day' }),
        days: [
          { day: makeDay({ day_date: '2026-05-01' }), stops: [] },
          { day: makeDay({ day_date: '2026-05-02' }), stops: [makeStop()] },
        ],
      }),
      makeBundle({
        trip: makeTrip({ id: 'b', name: 'Starts with a stop' }),
        days: [{ day: makeDay({ day_date: '2026-05-03' }), stops: [makeStop()] }],
      }),
    ])
    expect(records.map((r) => r.trip_name)).toEqual([
      'Starts with a stop',
      'Has empty first day',
    ])
  })

  it('sorts a trip with no stops at all (no dated first stop) after every dated trip', () => {
    const records = buildTripsExportData([
      makeBundle({
        trip: makeTrip({ id: 'a', name: 'No stops' }),
        days: [{ day: makeDay({ day_date: '2026-01-01' }), stops: [] }],
      }),
      makeBundle({
        trip: makeTrip({ id: 'b', name: 'Has a stop' }),
        days: [{ day: makeDay({ day_date: '2026-01-01' }), stops: [makeStop()] }],
      }),
    ])
    expect(records.map((r) => r.trip_name)).toEqual(['Has a stop', 'No stops'])
  })

  it('sorts a trip whose first-stop day has a null date after every dated trip', () => {
    const records = buildTripsExportData([
      makeBundle({
        trip: makeTrip({ id: 'a', name: 'Undated first stop' }),
        days: [{ day: makeDay({ day_date: null }), stops: [makeStop()] }],
      }),
      makeBundle({
        trip: makeTrip({ id: 'b', name: 'Dated first stop' }),
        days: [{ day: makeDay({ day_date: '2026-01-01' }), stops: [makeStop()] }],
      }),
    ])
    expect(records.map((r) => r.trip_name)).toEqual([
      'Dated first stop',
      'Undated first stop',
    ])
  })
})
