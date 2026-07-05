import { describe, expect, it } from 'vitest'
import {
  distinctCities,
  parseItineraryJson,
  tripSummary,
  type TripDraft,
} from './itinerary-import'

describe('parseItineraryJson', () => {
  it('parses a valid trip array, mapping fields and snapping China provinces', () => {
    const json = JSON.stringify([
      {
        trip_name: '湖北',
        status: 'visited',
        base_currency: 'CNY',
        days: [
          {
            date: '2026-03-28',
            stops: [
              {
                type: 'travel',
                description: 'Train: 香港 → 荆州',
                city: '荆州',
                country: 'China',
                province: '湖北省',
                completion: 'done',
              },
            ],
          },
        ],
      },
    ])
    const r = parseItineraryJson(json)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.trips).toHaveLength(1)
    const trip = r.trips[0]!
    expect(trip.name).toBe('湖北')
    expect(trip.days[0]!.date).toBe('2026-03-28')
    const stop = trip.days[0]!.stops[0]!
    expect(stop.type).toBe('travel')
    expect(stop.description).toBe('Train: 香港 → 荆州')
    expect(stop.province).toBe('湖北') // snapped from 湖北省
    expect(stop.completion).toBe('done')
  })

  it('coerces bad enums and defaults, ignoring removed fields', () => {
    const json = JSON.stringify([
      {
        trip_name: 'X',
        status: 'nope',
        days: [{ stops: [{ type: 'weird', time: 'bad', cost: 12 }] }],
      },
    ])
    const r = parseItineraryJson(json)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.trips[0]!.status).toBe('visited')
    expect(r.trips[0]!.base_currency).toBe('CNY')
    const stop = r.trips[0]!.days[0]!.stops[0]!
    expect(stop.type).toBe('other')
    expect(stop).not.toHaveProperty('time')
    expect(stop).not.toHaveProperty('cost')
  })

  it('keeps a foreign province verbatim', () => {
    const json = JSON.stringify([
      {
        trip_name: 'EU',
        days: [
          {
            stops: [
              {
                type: 'visit',
                city: 'Paris',
                country: 'France',
                province: 'Île-de-France',
              },
            ],
          },
        ],
      },
    ])
    const r = parseItineraryJson(json)
    expect(r.ok && r.trips[0]!.days[0]!.stops[0]!.province).toBe('Île-de-France')
  })

  it('skips a trip with no name, warning', () => {
    const r = parseItineraryJson(
      JSON.stringify([{ days: [] }, { trip_name: 'Y', days: [] }]),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.trips.map((t) => t.name)).toEqual(['Y'])
    expect(r.warnings.some((w) => /Trip 1/.test(w))).toBe(true)
  })

  it('repairs a stray quote after a number', () => {
    const broken =
      '[{"trip_name":"X","days":[{"date":null,"stops":[{"type":"visit","sort":58"}]}]}]'
    const r = parseItineraryJson(broken)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.trips[0]!.days[0]!.stops[0]!.type).toBe('visit')
  })

  it('repairs a missing comma before a new key', () => {
    const broken = '[{"trip_name":"X"\n"days":[]}]'
    const r = parseItineraryJson(broken)
    expect(r.ok).toBe(true)
  })

  it('parses notes and url fields, preserving newlines in notes', () => {
    const json = JSON.stringify([
      {
        trip_name: 'Xinjiang',
        notes: '没去: 乌鲁木齐-吐鲁番北(09:30-10:27 ¥103)\n10:30-11:30: 高昌故城¥70+30',
        url: 'https://example.com/cover.jpg',
        days: [{ stops: [{ type: 'visit' }] }],
      },
    ])
    const r = parseItineraryJson(json)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.trips[0]!.notes).toBe(
      '没去: 乌鲁木齐-吐鲁番北(09:30-10:27 ¥103)\n10:30-11:30: 高昌故城¥70+30',
    )
    expect(r.trips[0]!.cover_url).toBe('https://example.com/cover.jpg')
  })

  it('treats null and absent notes/url as null', () => {
    const json = JSON.stringify([
      { trip_name: 'A', notes: null, url: null, days: [{ stops: [{ type: 'visit' }] }] },
      { trip_name: 'B', days: [{ stops: [{ type: 'visit' }] }] },
    ])
    const r = parseItineraryJson(json)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.trips[0]!.notes).toBeNull()
    expect(r.trips[0]!.cover_url).toBeNull()
    expect(r.trips[1]!.notes).toBeNull()
    expect(r.trips[1]!.cover_url).toBeNull()
  })

  it('rejects non-array and empty input', () => {
    expect(parseItineraryJson('{"trip_name":"X"}').ok).toBe(false)
    expect(parseItineraryJson('   ').ok).toBe(false)
    expect(parseItineraryJson('not json').ok).toBe(false)
  })
})

describe('distinctCities / tripSummary', () => {
  const trips: TripDraft[] = [
    {
      name: 'A',
      status: 'visited',
      base_currency: 'CNY',
      companions: 'Mary',
      rating: 4,
      notes: null,
      cover_url: null,
      days: [
        {
          date: null,
          stops: [
            {
              type: 'visit',
              city: '荆州',
              country: 'China',
              province: '湖北',
              description: null,
              details: null,
              completion: null,
            },
            {
              type: 'eat',
              city: '荆州',
              country: 'China',
              province: '湖北',
              description: null,
              details: null,
              completion: null,
            },
            {
              type: 'travel',
              city: '武汉',
              country: 'China',
              province: '湖北',
              description: null,
              details: null,
              completion: null,
            },
          ],
        },
      ],
    },
  ]

  it('dedups cities by name', () => {
    expect(distinctCities(trips).map((c) => c.city)).toEqual(['荆州', '武汉'])
  })

  it('summarizes days/stops by type', () => {
    const s = tripSummary(trips[0]!)
    expect(s.days).toBe(1)
    expect(s.stops).toBe(3)
    expect(s.byType).toEqual({ visit: 1, eat: 1, travel: 1 })
  })
})
