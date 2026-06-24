import { describe, expect, it } from 'vitest'
import { CHINA_PROVINCES } from './travel'

describe('CHINA_PROVINCES', () => {
  it('has exactly 34 province-level divisions', () => {
    expect(CHINA_PROVINCES).toHaveLength(34)
  })
  it('has no duplicates', () => {
    expect(new Set(CHINA_PROVINCES).size).toBe(CHINA_PROVINCES.length)
  })
  it('uses bare canonical names (no admin-type suffix)', () => {
    // DataV ships suffixed names (北京市, 广西壮族自治区); CHINA_PROVINCES is the bare vocabulary the
    // owner stores in stop.province, so the map normalization strips down TO these — none may carry a
    // 省/市/区 suffix themselves.
    for (const name of CHINA_PROVINCES) {
      expect(name).not.toMatch(/[省市区]$/)
    }
  })
  it('includes the two SARs', () => {
    expect(CHINA_PROVINCES).toContain('香港')
    expect(CHINA_PROVINCES).toContain('澳门')
  })
})
