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

describe('getDriForProfile (female 31–50)', () => {
  // A 48-year-old resolves the 31–50 band (51 is the menopause-proxy cutoff).
  const dri = getDriForProfile(
    { sex: 'female', birthdayAge: 48, proteinTargetG: null },
    energyKcal,
  )

  it('uses the premenopausal iron RDA (18 mg) instead of 8 mg', () => {
    expect(dri.iron).toMatchObject({ target: 18, ul: 45, ulScope: 'total' })
  })

  it('uses calcium 1000 mg with the higher 2500 mg UL (UL drops to 2000 at 51)', () => {
    expect(dri.calcium).toMatchObject({ target: 1000, ul: 2500, ulScope: 'total' })
    expect(isOverUpperLimit(2100, dri.calcium!)).toBe(false)
  })

  it('overrides fiber 25, omega6 12, b6 1.3, chromium 25', () => {
    expect(dri.fiber?.target).toBe(25)
    expect(dri.omega6?.target).toBe(12)
    expect(dri.b6?.target).toBe(1.3)
    expect(dri.chromium?.target).toBe(25)
  })

  it('keeps the shared adult-female values (protein RDA 46, magnesium 320)', () => {
    expect(dri.protein?.target).toBe(46) // no override passed
    expect(dri.magnesium?.target).toBe(320)
  })
})

describe('getDriForProfile (male 31–50 / 51–70)', () => {
  const m40 = getDriForProfile(
    { sex: 'male', birthdayAge: 40, proteinTargetG: null },
    energyKcal,
  )
  const m60 = getDriForProfile(
    { sex: 'male', birthdayAge: 60, proteinTargetG: null },
    energyKcal,
  )

  it('uses the male base values (protein 56, water 3700, zinc 11, potassium 3400)', () => {
    expect(m60.protein?.target).toBe(56)
    expect(m60.water?.target).toBe(3700)
    expect(m60.zinc?.target).toBe(11)
    expect(m60.potassium?.target).toBe(3400)
  })

  it('51–70: calcium 1000 / UL 2000, b6 1.7, fiber 30, magnesium 420', () => {
    expect(m60.calcium).toMatchObject({ target: 1000, ul: 2000, ulScope: 'total' })
    expect(m60.b6?.target).toBe(1.7)
    expect(m60.fiber?.target).toBe(30)
    expect(m60.magnesium?.target).toBe(420)
  })

  it('31–50: calcium UL 2500, b6 1.3, fiber 38, chromium 35 (vs the 51–70 band)', () => {
    expect(m40.calcium).toMatchObject({ target: 1000, ul: 2500 })
    expect(m40.b6?.target).toBe(1.3)
    expect(m40.fiber?.target).toBe(38)
    expect(m40.chromium?.target).toBe(35)
  })
})

describe('getDriForProfile (71+ bands)', () => {
  const f75 = getDriForProfile(
    { sex: 'female', birthdayAge: 75, proteinTargetG: null },
    energyKcal,
  )
  const m75 = getDriForProfile(
    { sex: 'male', birthdayAge: 75, proteinTargetG: null },
    energyKcal,
  )

  it('raises vitamin D to 20 µg and drops the phosphorus UL to 3000 for both sexes', () => {
    expect(f75.vitamin_d?.target).toBe(20)
    expect(m75.vitamin_d?.target).toBe(20)
    expect(f75.phosphorus).toMatchObject({ ul: 3000 })
    expect(m75.phosphorus).toMatchObject({ ul: 3000 })
  })

  it('female 71+ keeps calcium 1200 / iron 8; male 71+ raises calcium to 1200', () => {
    expect(f75.calcium?.target).toBe(1200)
    expect(f75.iron?.target).toBe(8)
    expect(m75.calcium).toMatchObject({ target: 1200, ul: 2000 })
  })
})

describe('getDriForProfile (unsupported band)', () => {
  it('throws below the supported adult range (under 31)', () => {
    expect(() =>
      getDriForProfile({ sex: 'female', birthdayAge: 25, proteinTargetG: null }, 2000),
    ).toThrow(/No DRI table/)
    expect(() =>
      getDriForProfile({ sex: 'male', birthdayAge: 20, proteinTargetG: null }, 2000),
    ).toThrow(/No DRI table/)
  })

  it('throws for an unrecognized sex', () => {
    expect(() =>
      getDriForProfile({ sex: 'other', birthdayAge: 40, proteinTargetG: null }, 2000),
    ).toThrow(/No DRI table/)
  })
})
