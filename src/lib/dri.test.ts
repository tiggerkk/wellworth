import { describe, expect, it } from 'vitest'
import { getDriForProfile, type DriProfile } from './dri'
import { isOverUpperLimit } from './nutrients'

const owner: DriProfile = { sex: 'female', birthdayAge: 51, proteinTargetG: 90 }
const energyKcal = 1700

describe('getDriForProfile (female 51–70)', () => {
  const dri = getDriForProfile(owner, energyKcal)

  it('returns calcium target 1200 / UL 2000 (total)', () => {
    expect(dri.calcium).toMatchObject({ target: 1200, ul: 2000, ulScope: 'total' })
    expect(isOverUpperLimit(2100, dri.calcium!)).toBe(true)
  })

  it('tags magnesium UL as supplemental so dietary magnesium never fires red', () => {
    expect(dri.magnesium).toMatchObject({ ul: 350, ulScope: 'supplemental' })
    expect(isOverUpperLimit(500, dri.magnesium!)).toBe(false)
  })

  it('treats sodium 2300 as a CDRR ceiling that fires red', () => {
    expect(dri.sodium).toMatchObject({ target: 1500, ul: 2300, ulScope: 'cdrr' })
    expect(isOverUpperLimit(2400, dri.sodium!)).toBe(true)
  })

  it('honors the protein override (90 g) over the RDA (46 g)', () => {
    expect(dri.protein?.target).toBe(90)
  })

  it('stores copper in mg (target 0.9 / UL 10)', () => {
    expect(dri.copper).toMatchObject({ target: 0.9, ul: 10 })
  })

  it('derives energy-based soft targets from the kcal target', () => {
    // saturated <10% kcal: 0.10 * 1700 / 9 ≈ 18.9 g, fires red as a guidance ceiling
    expect(dri.saturated?.target).toBeCloseTo((0.1 * energyKcal) / 9, 4)
    expect(dri.added_sugars).toMatchObject({ ulScope: 'guidance' })
    // fat AMDR 35% kcal: 0.35 * 1700 / 9 ≈ 66.1 g, no red bar
    expect(dri.fat?.target).toBeCloseTo((0.35 * energyKcal) / 9, 4)
    expect(dri.fat?.ul).toBeNull()
  })

  it('exposes energy as the computed kcal target', () => {
    expect(dri.energy).toMatchObject({ target: energyKcal, targetType: 'computed' })
  })
})

describe('getDriForProfile (unsupported band)', () => {
  it('throws for a band that is not populated', () => {
    expect(() =>
      getDriForProfile({ sex: 'male', birthdayAge: 40, proteinTargetG: null }, 2000),
    ).toThrow(/No DRI table/)
  })
})
