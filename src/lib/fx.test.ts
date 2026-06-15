import { describe, expect, it } from 'vitest'
import { fxUrl, parseFrankfurterRate } from './fx'

describe('fxUrl', () => {
  it('targets the 1st of the month, native → HKD', () => {
    expect(fxUrl('USD', '2026-06-15')).toBe(
      'https://api.frankfurter.dev/v1/2026-06-01?from=USD&to=HKD',
    )
    expect(fxUrl('CNY', '2026-06-01')).toBe(
      'https://api.frankfurter.dev/v1/2026-06-01?from=CNY&to=HKD',
    )
  })
})

describe('parseFrankfurterRate', () => {
  it('returns the HKD rate', () => {
    expect(parseFrankfurterRate({ rates: { HKD: 7.81 } })).toBeCloseTo(7.81)
  })
  it('throws on a missing or non-positive rate', () => {
    expect(() => parseFrankfurterRate({ rates: {} })).toThrow()
    expect(() => parseFrankfurterRate({})).toThrow()
    expect(() => parseFrankfurterRate({ rates: { HKD: 0 } })).toThrow()
    expect(() => parseFrankfurterRate(null)).toThrow()
  })
})
