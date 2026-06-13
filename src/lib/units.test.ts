import { describe, expect, it } from 'vitest'
import {
  cmToInches,
  fluidOuncesToMl,
  gramsToOunces,
  inchesToCm,
  kgToPounds,
  ouncesToGrams,
  poundsToKg,
} from './units'

describe('units conversion', () => {
  it('converts grams and ounces symmetrically', () => {
    expect(ouncesToGrams(1)).toBeCloseTo(28.3495, 4)
    expect(gramsToOunces(28.3495)).toBeCloseTo(1, 4)
  })

  it('converts kilograms to pounds', () => {
    expect(kgToPounds(56)).toBeCloseTo(123.459, 2)
    expect(poundsToKg(kgToPounds(56))).toBeCloseTo(56, 6)
  })

  it('converts centimetres to inches', () => {
    expect(cmToInches(171)).toBeCloseTo(67.323, 2)
    expect(inchesToCm(1)).toBeCloseTo(2.54, 4)
  })

  it('converts fluid ounces to millilitres', () => {
    expect(fluidOuncesToMl(1)).toBeCloseTo(29.5735, 4)
  })
})
