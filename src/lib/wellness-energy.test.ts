import { describe, expect, it } from 'vitest'
import {
  ageFromBirthday,
  bmrMifflinStJeor,
  energyTarget,
  netEnergy,
} from './wellness-energy'

describe('ageFromBirthday', () => {
  it('counts whole years and respects the month/day boundary', () => {
    expect(ageFromBirthday('1974-09-06', new Date('2026-06-13'))).toBe(51)
    expect(ageFromBirthday('1974-09-06', new Date('2026-09-06'))).toBe(52)
    expect(ageFromBirthday('1974-09-06', new Date('2026-09-05'))).toBe(51)
  })
})

describe('bmrMifflinStJeor', () => {
  it('computes the owner BMR (female 56 kg / 171 cm / age 51)', () => {
    // 10*56 + 6.25*171 - 5*51 - 161 = 1212.75
    expect(
      bmrMifflinStJeor({ weightKg: 56, heightCm: 171, age: 51, sex: 'female' }),
    ).toBeCloseTo(1212.75, 2)
  })

  it('adds 5 for male instead of subtracting 161', () => {
    const female = bmrMifflinStJeor({
      weightKg: 56,
      heightCm: 171,
      age: 51,
      sex: 'female',
    })
    const male = bmrMifflinStJeor({ weightKg: 56, heightCm: 171, age: 51, sex: 'male' })
    expect(male - female).toBe(166)
  })
})

describe('energyTarget / netEnergy', () => {
  it('applies the activity factor', () => {
    expect(energyTarget(1212.75, 1.4)).toBeCloseTo(1697.85, 2)
  })

  it('nets consumed minus BMR minus activity', () => {
    expect(netEnergy({ consumed: 1800, bmr: 1212.75, activity: 300 })).toBeCloseTo(
      287.25,
      2,
    )
  })
})
