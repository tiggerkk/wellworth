import { describe, expect, it } from 'vitest'
import {
  CHINA_PROVINCE_TOTAL,
  compareProvinces,
  computeCityVisitStats,
  computeProvinceVisitStats,
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

describe('compareProvinces', () => {
  it('orders municipalities, then provinces, then autonomous regions, then SARs', () => {
    const shuffled = ['香港', '新疆', '湖北', '北京', '澳门', '内蒙古', '广东', '上海']
    expect([...shuffled].sort(compareProvinces)).toEqual([
      '北京', // municipality
      '上海', // municipality
      '湖北', // province
      '广东', // province
      '内蒙古', // autonomous region
      '新疆', // autonomous region
      '香港', // SAR
      '澳门', // SAR
    ])
  })

  it('sorts non-canonical names after all canonical provinces', () => {
    expect(['Somewhere', '湖北'].sort(compareProvinces)).toEqual(['湖北', 'Somewhere'])
  })
})

describe('computeProvinceVisitStats', () => {
  const trips = [
    trip({ id: 'a', status: 'visited' }),
    trip({ id: 'b', status: 'visited' }),
    trip({ id: 'c', status: 'planning' }),
  ]

  it('counts a province once per trip even if visited via multiple stops', () => {
    const facets: StatFacetRow[] = [
      { trip_id: 'a', city: '荆州', country: 'China', province: '湖北' },
      { trip_id: 'a', city: '武汉', country: 'China', province: '湖北' }, // same trip, same province
      { trip_id: 'b', city: '肇庆', country: 'China', province: '广东' },
    ]
    const s = computeProvinceVisitStats(trips, facets)
    expect(s.visited).toEqual([
      { province: '湖北', tripCount: 1 },
      { province: '广东', tripCount: 1 },
    ])
  })

  it('sorts visited by trip count desc, then province group order tie-break', () => {
    const facets: StatFacetRow[] = [
      { trip_id: 'a', city: '荆州', country: 'China', province: '湖北' },
      { trip_id: 'b', city: '广州', country: 'China', province: '广东' },
    ]
    const s = computeProvinceVisitStats(
      [...trips, trip({ id: 'd', status: 'visited' })],
      [...facets, { trip_id: 'd', city: '荆州', country: 'China', province: '湖北' }],
    )
    expect(s.visited.map((r) => r.province)).toEqual(['湖北', '广东'])
    expect(s.visited[0]!.tripCount).toBe(2)
  })

  it('excludes planning trips and lists unvisited provinces in group order', () => {
    const facets: StatFacetRow[] = [
      { trip_id: 'a', city: '荆州', country: 'China', province: '湖北' },
      { trip_id: 'c', city: 'Tokyo', country: 'Japan', province: null },
    ]
    const s = computeProvinceVisitStats(trips, facets)
    expect(s.visited).toEqual([{ province: '湖北', tripCount: 1 }])
    expect(s.unvisited.length).toBe(CHINA_PROVINCE_TOTAL - 1)
    expect(s.unvisited).not.toContain('湖北')
    expect([...s.unvisited].sort(compareProvinces)).toEqual(s.unvisited)
  })
})

describe('computeCityVisitStats', () => {
  const trips = [
    trip({ id: 'a', status: 'visited' }),
    trip({ id: 'b', status: 'visited' }),
    trip({ id: 'c', status: 'planning' }),
  ]

  it('counts a city once per trip even if visited via multiple stops', () => {
    const facets: StatFacetRow[] = [
      { trip_id: 'a', city: '武汉', country: 'China', province: '湖北' },
      { trip_id: 'a', city: '武汉', country: 'China', province: '湖北' }, // duplicate stop, same trip
      { trip_id: 'b', city: '武汉', country: 'China', province: '湖北' },
    ]
    const rows = computeCityVisitStats(trips, facets)
    expect(rows).toEqual([{ province: '湖北', city: '武汉', tripCount: 2 }])
  })

  it('groups by province group order, then city asc, independent of trip counts', () => {
    const facets: StatFacetRow[] = [
      { trip_id: 'a', city: '武汉', country: 'China', province: '湖北' },
      { trip_id: 'b', city: '荆州', country: 'China', province: '湖北' },
      { trip_id: 'a', city: '广州', country: 'China', province: '广东' },
    ]
    const rows = computeCityVisitStats(trips, facets)
    expect(rows.map((r) => `${r.province}/${r.city}`)).toEqual([
      '湖北/荆州',
      '湖北/武汉',
      '广东/广州',
    ])
  })

  it('excludes planning trips and non-China facet rows', () => {
    const facets: StatFacetRow[] = [
      { trip_id: 'a', city: '武汉', country: 'China', province: '湖北' },
      { trip_id: 'c', city: 'Tokyo', country: 'Japan', province: null },
      { trip_id: 'a', city: 'Paris', country: 'France', province: null },
    ]
    const rows = computeCityVisitStats(trips, facets)
    expect(rows).toEqual([{ province: '湖北', city: '武汉', tripCount: 1 }])
  })
})
