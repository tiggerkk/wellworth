import { describe, expect, it } from 'vitest'
import { cityFromAddress, snapProvince, toSuggestion } from './travel-places'

describe('snapProvince', () => {
  it('passes through canonical names', () => {
    expect(snapProvince('湖北')).toBe('湖北')
    expect(snapProvince('北京')).toBe('北京')
    expect(snapProvince('香港')).toBe('香港')
  })
  it('strips Chinese admin-type suffixes', () => {
    expect(snapProvince('湖北省')).toBe('湖北')
    expect(snapProvince('北京市')).toBe('北京')
    expect(snapProvince('西藏自治区')).toBe('西藏')
    expect(snapProvince('香港特别行政区')).toBe('香港')
  })
  it('maps ethnic-qualified autonomous regions via the alias table', () => {
    expect(snapProvince('广西壮族自治区')).toBe('广西')
    expect(snapProvince('新疆维吾尔自治区')).toBe('新疆')
    expect(snapProvince('宁夏回族自治区')).toBe('宁夏')
    expect(snapProvince('内蒙古自治区')).toBe('内蒙古')
  })
  it('maps English admin-1 names (exact and verbose)', () => {
    expect(snapProvince('Hubei')).toBe('湖北')
    expect(snapProvince('Beijing')).toBe('北京')
    expect(snapProvince('Tibet Autonomous Region')).toBe('西藏')
    expect(snapProvince('Inner Mongolia Autonomous Region')).toBe('内蒙古')
    expect(snapProvince('Hong Kong')).toBe('香港')
    expect(snapProvince('Macao')).toBe('澳门')
  })
  it('distinguishes Shanxi from Shaanxi', () => {
    expect(snapProvince('Shanxi')).toBe('山西')
    expect(snapProvince('Shaanxi')).toBe('陕西')
  })
  it('returns null for non-Chinese / unknown / empty', () => {
    expect(snapProvince('Île-de-France')).toBeNull()
    expect(snapProvince('California')).toBeNull()
    expect(snapProvince('')).toBeNull()
    expect(snapProvince(null)).toBeNull()
  })
})

describe('cityFromAddress', () => {
  it('prefers city, then town/village/…', () => {
    expect(cityFromAddress({ city: 'Wuhan', county: 'X' }, 'fb')).toBe('Wuhan')
    expect(cityFromAddress({ town: 'Jingzhou' }, 'fb')).toBe('Jingzhou')
    expect(cityFromAddress({}, 'fallback')).toBe('fallback')
  })
})

describe('toSuggestion', () => {
  it('snaps the province and parses coords', () => {
    const s = toSuggestion({
      display_name: '荆州, 湖北省, China',
      lat: '30.33',
      lon: '112.24',
      address: { city: '荆州', state: '湖北省', country: 'China' },
    })
    expect(s).not.toBeNull()
    expect(s!.city).toBe('荆州')
    expect(s!.province).toBe('湖北')
    expect(s!.country).toBe('China')
    expect(s!.lat).toBeCloseTo(30.33)
  })
  it('drops results with invalid coordinates', () => {
    expect(toSuggestion({ lat: 'x', lon: 'y' })).toBeNull()
  })
})
