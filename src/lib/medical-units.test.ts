import { describe, expect, it } from 'vitest'
import { normalizeResult } from './medical-units'

const base = {
  value_num: null,
  unit: null,
  ref_low: null,
  ref_high: null,
  test_key: null,
}

describe('normalizeResult', () => {
  it('scales g/L → g/dL (÷10) for haemoglobin, preserving the original + ref', () => {
    const out = normalizeResult({
      ...base,
      test_key: 'haemoglobin',
      value_num: 148,
      unit: 'g/L',
      ref_low: 120,
      ref_high: 180,
    })
    expect(out.value_num).toBe(14.8)
    expect(out.unit).toBe('g/dL')
    expect(out.ref_low).toBe(12)
    expect(out.ref_high).toBe(18)
    expect(out.normalized).toBe(true)
    expect(out.value_num_original).toBe(148)
    expect(out.unit_original).toBe('g/L')
  })

  it('scales µmol/L → mmol/L (÷1000) for uric acid', () => {
    const out = normalizeResult({
      ...base,
      test_key: 'uric_acid',
      value_num: 211,
      unit: 'µmol/L',
    })
    expect(out.value_num).toBe(0.211)
    expect(out.unit).toBe('mmol/L')
    expect(out.normalized).toBe(true)
  })

  it('label-only canonicalizes µmol/L → umol/L for creatinine (value unchanged, flagged)', () => {
    const out = normalizeResult({
      ...base,
      test_key: 'creatinine',
      value_num: 60.6,
      unit: 'µmol/L',
    })
    expect(out.value_num).toBe(60.6)
    expect(out.unit).toBe('umol/L')
    expect(out.normalized).toBe(true)
    expect(out.unit_original).toBe('µmol/L')
  })

  it('folds "international unit/L" → U/L (enzymes)', () => {
    const out = normalizeResult({
      ...base,
      test_key: 'alt_sgpt',
      value_num: 18,
      unit: 'international unit/L',
    })
    expect(out.unit).toBe('U/L')
    expect(out.value_num).toBe(18)
    expect(out.normalized).toBe(true)
  })

  it('folds kU/L → U/mL (CA markers) and µg/L → ng/mL (CEA)', () => {
    expect(
      normalizeResult({ ...base, test_key: 'ca_125', value_num: 10, unit: 'kU/L' }).unit,
    ).toBe('U/mL')
    expect(
      normalizeResult({ ...base, test_key: 'cea', value_num: 3, unit: 'µg/L' }).unit,
    ).toBe('ng/mL')
  })

  it('leaves an already-canonical unit untouched (not flagged)', () => {
    const out = normalizeResult({
      ...base,
      test_key: 'alt_sgpt',
      value_num: 18,
      unit: 'U/L',
    })
    expect(out.normalized).toBe(false)
    expect(out.value_num_original).toBeNull()
  })

  it('does not touch an unknown unit pair or a missing test_key', () => {
    expect(
      normalizeResult({ ...base, test_key: 'creatinine', value_num: 1, unit: 'mg/dL' })
        .normalized,
    ).toBe(false)
    expect(
      normalizeResult({ ...base, test_key: null, value_num: 1, unit: 'g/L' }).normalized,
    ).toBe(false)
  })
})
