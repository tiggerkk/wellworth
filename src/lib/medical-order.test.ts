import { describe, expect, it } from 'vitest'
import {
  buildOrderModel,
  effectiveSectionOrder,
  effectiveTestOrderForCategory,
  flattenTestOrder,
} from './medical-order'
import { MEDICAL_CATEGORIES, MEDICAL_LAB_TESTS } from './medical'

describe('effectiveSectionOrder', () => {
  it('returns the canonical order when there is no override', () => {
    expect(effectiveSectionOrder(null)).toEqual([...MEDICAL_CATEGORIES])
    expect(effectiveSectionOrder([])).toEqual([...MEDICAL_CATEGORIES])
  })

  it('honours the override then appends any missing categories, canonical', () => {
    const out = effectiveSectionOrder(['renal', 'lipids'])
    expect(out.slice(0, 2)).toEqual(['renal', 'lipids'])
    // every category present exactly once
    expect(new Set(out).size).toBe(MEDICAL_CATEGORIES.length)
    expect(out).toHaveLength(MEDICAL_CATEGORIES.length)
  })

  it('drops invalid / duplicate override entries', () => {
    const out = effectiveSectionOrder(['bogus', 'lipids', 'lipids'])
    expect(out[0]).toBe('lipids')
    expect(out.filter((c) => c === 'lipids')).toHaveLength(1)
    expect(out).toHaveLength(MEDICAL_CATEGORIES.length)
  })
})

describe('effectiveTestOrderForCategory', () => {
  it('returns the seeded order when there is no override', () => {
    const seeded = MEDICAL_LAB_TESTS.filter((t) => t.category === 'lipids')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t) => t.key)
    expect(effectiveTestOrderForCategory('lipids', null)).toEqual(seeded)
  })

  it('honours override entries for that category, ignoring other categories, then appends missing', () => {
    // ldl + hdl reordered to the front; a renal key in the flat override is ignored here.
    const out = effectiveTestOrderForCategory('lipids', [
      'hdl_cholesterol',
      'creatinine',
      'ldl_cholesterol',
    ])
    expect(out.slice(0, 2)).toEqual(['hdl_cholesterol', 'ldl_cholesterol'])
    expect(out).toContain('total_cholesterol') // missing ones appended
    expect(out).not.toContain('creatinine')
    // complete + unique
    const seededCount = MEDICAL_LAB_TESTS.filter((t) => t.category === 'lipids').length
    expect(out).toHaveLength(seededCount)
    expect(new Set(out).size).toBe(seededCount)
  })
})

describe('buildOrderModel + flattenTestOrder', () => {
  it('round-trips: model flattened back groups tests by section order', () => {
    const { sectionOrder, testsByCategory } = buildOrderModel(['renal', 'lipids'], null)
    const flat = flattenTestOrder(sectionOrder, testsByCategory)
    // renal tests come before lipids tests in the flattened order
    const firstLipidIdx = flat.indexOf('ldl_cholesterol')
    const lastRenalIdx = flat.indexOf('uric_acid')
    expect(lastRenalIdx).toBeLessThan(firstLipidIdx)
    // every seeded test appears exactly once
    expect(flat).toHaveLength(MEDICAL_LAB_TESTS.length)
    expect(new Set(flat).size).toBe(MEDICAL_LAB_TESTS.length)
  })
})
