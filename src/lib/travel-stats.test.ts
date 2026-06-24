import { describe, expect, it } from 'vitest'
import {
  CHINA_PROVINCE_TOTAL,
  computeTravelStats,
  isChinaCountry,
  type StatFacetRow,
} from './travel-stats'
import type { TripRow } from './travel'

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

describe('CHINA_PROVINCE_TOTAL', () => {
  it('is 34', () => {
    expect(CHINA_PROVINCE_TOTAL).toBe(34)
  })
})

describe('isChinaCountry', () => {
  it('matches China spellings, rejects others', () => {
    expect(isChinaCountry('China')).toBe(true)
    expect(isChinaCountry('中国')).toBe(true)
    expect(isChinaCountry(' china ')).toBe(true)
    expect(isChinaCountry('France')).toBe(false)
    expect(isChinaCountry(null)).toBe(false)
  })
})

describe('computeTravelStats', () => {
  const trips = [
    trip({
      id: 'a',
      status: 'visited',
      start_date: '2026-03-28',
      end_date: '2026-04-01',
    }),
    trip({
      id: 'b',
      status: 'visited',
      start_date: '2025-01-30',
      end_date: '2025-01-31',
    }),
    trip({
      id: 'c',
      status: 'planning',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
    }),
  ]
  const facets: StatFacetRow[] = [
    { trip_id: 'a', city: '荆州', country: 'China', province: '湖北' },
    { trip_id: 'a', city: '武汉', country: 'China', province: '湖北' },
    { trip_id: 'b', city: '肇庆', country: 'China', province: '广东' },
    { trip_id: 'c', city: 'Tokyo', country: 'Japan', province: null }, // planning → excluded
    { trip_id: 'a', city: 'Paris', country: 'France', province: 'Île-de-France' },
  ]

  it('counts distinct places only over visited trips', () => {
    const s = computeTravelStats(trips, facets, '2026')
    expect(s.chinaProvinces).toBe(2) // 湖北, 广东
    expect(s.chinaCities).toBe(3) // 荆州, 武汉, 肇庆
    expect(s.countries).toBe(2) // China, France (Japan excluded — planning)
    expect(s.cities).toBe(4) // 荆州, 武汉, 肇庆, Paris
  })

  it('ignores non-canonical provinces in the China count', () => {
    const s = computeTravelStats(
      [trip({ id: 'a', status: 'visited' })],
      [{ trip_id: 'a', city: 'X', country: 'China', province: 'Somewhere' }],
      '2026',
    )
    expect(s.chinaProvinces).toBe(0)
  })

  it('counts trips this year and inclusive days travelled', () => {
    const s = computeTravelStats(trips, facets, '2026')
    expect(s.tripsThisYear).toBe(1) // only trip a (visited, 2026)
    expect(s.daysTravelled).toBe(5 + 2) // a: Mar28–Apr1 = 5, b: Jan30–31 = 2
  })
})
