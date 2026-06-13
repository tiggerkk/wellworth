import { describe, expect, it } from 'vitest'
import { activityEnergyKcal, resolveMet } from './met'

describe('resolveMet', () => {
  it('selects the MET for the chosen effort', () => {
    expect(resolveMet({ light: 3.5, moderate: 3.5 }, 'moderate')).toBe(3.5)
    expect(resolveMet({ vigorous: 6 }, 'light')).toBeUndefined()
  })
})

describe('activityEnergyKcal', () => {
  it('is MET × kg × hours', () => {
    // 7 MET × 56 kg × 0.5 h = 196 kcal
    expect(activityEnergyKcal({ met: 7, weightKg: 56, minutes: 30 })).toBeCloseTo(196, 6)
  })
})
