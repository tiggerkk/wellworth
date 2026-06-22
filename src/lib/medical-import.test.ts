import { describe, expect, it } from 'vitest'
import {
  matchTestKey,
  parseMedicalCsv,
  parseMedicalJson,
  repairMedicalJson,
} from './medical-import'

describe('repairMedicalJson', () => {
  it('strips a stray quote after a numeric value (the observed AI glitch)', () => {
    expect(repairMedicalJson('"ref_high": 8.6",')).toBe('"ref_high": 8.6,')
    expect(repairMedicalJson('"v": 1.7"\n')).toBe('"v": 1.7\n')
  })
  it('leaves real string values alone', () => {
    const s = '"unit": "U/L", "ref_text": "0.5-8.6"'
    expect(repairMedicalJson(s)).toBe(s)
  })
})

describe('parseMedicalJson', () => {
  it('parses a report with the stray-quote glitch and reports a clear error otherwise', () => {
    // The real 2026-file glitch: a stray quote after ref_high (`8.6"`) before the next key.
    const glitchy =
      '{"report_type":"health_screening","results":[' +
      '{"test_name":"Bilirubin, Direct","category":"liver","value_num":3.0,' +
      '"ref_high":8.6","ref_text":"0.5-8.6"}]}'
    const good = parseMedicalJson(glitchy)
    expect(good.ok).toBe(true)
    if (good.ok) expect(good.report.results[0]!.ref_high).toBe(8.6)

    const bad = parseMedicalJson('{ not json')
    expect(bad.ok).toBe(false)
  })

  it('validates enums with safe fallbacks (report_type/category/flag)', () => {
    const r = parseMedicalJson(
      `{"report_type":"weird","results":[{"test_name":"Mystery","category":"nope","flag":"sideways"}]}`,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.report.report_type).toBe('other')
      expect(r.report.results[0]!.category).toBe('other')
      expect(r.report.results[0]!.flag).toBeNull()
      expect(r.report.results[0]!.test_key).toBeNull() // ad-hoc
    }
  })

  it('matches + unit-normalizes a Shanghai-style row (Hemoglobin g/L → g/dL)', () => {
    const r = parseMedicalJson(
      `{"report_type":"health_screening","results":[{"test_name":"Hemoglobin","category":"cbc","value_num":148,"unit":"g/L","ref_low":120,"ref_high":180}]}`,
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      const row = r.report.results[0]!
      expect(row.test_key).toBe('haemoglobin')
      expect(row.value_num).toBe(14.8)
      expect(row.unit).toBe('g/dL')
      expect(row.normalized).toBe(true)
      expect(row.value_num_original).toBe(148)
    }
  })

  it('errors when there is no results array', () => {
    const r = parseMedicalJson('{"report_type":"eye"}')
    expect(r.ok).toBe(false)
  })
})

describe('matchTestKey', () => {
  it('maps provider abbreviations / spellings to the canonical key', () => {
    expect(matchTestKey('SGOT', 'liver')).toBe('ast_sgot')
    expect(matchTestKey('SGPT', 'liver')).toBe('alt_sgpt')
    expect(matchTestKey('Blood Urea Nitrogen', 'renal')).toBe('urea')
    expect(matchTestKey('25OHD', 'bone')).toBe('vitamin_d_25oh')
    expect(matchTestKey('Hemoglobin', 'cbc')).toBe('haemoglobin')
    expect(matchTestKey('CO2 combining power', 'electrolytes')).toBe('bicarbonate')
    expect(matchTestKey('WBC', 'cbc')).toBe('wbc')
    expect(matchTestKey('T4', 'thyroid')).toBe('t4_total')
  })

  it('strips the Chinese portion of a bilingual name', () => {
    expect(matchTestKey('ALT/SGPT 谷丙轉氨酵素', 'liver')).toBe('alt_sgpt')
    expect(matchTestKey('Creatinine 肌酸酐', 'renal')).toBe('creatinine')
  })

  it('disambiguates by category (urine "Albumin" ≠ liver "Albumin")', () => {
    expect(matchTestKey('Albumin', 'urine')).toBe('urine_albumin')
    expect(matchTestKey('Albumin', 'liver')).toBe('albumin')
  })

  it('keeps the differential %/# distinction', () => {
    expect(matchTestKey('Neutrophils %', 'cbc')).toBe('neutrophils_pct')
    expect(matchTestKey('Neutrophils #', 'cbc')).toBe('neutrophils_abs')
  })

  it('returns null for an unknown test (kept ad-hoc)', () => {
    expect(matchTestKey('Some Novel Assay', 'other')).toBeNull()
  })
})

describe('parseMedicalCsv', () => {
  const header =
    'report_date,report_type,provider,body_part,narrative,test_name,category,value_num,value_text,unit,ref_low,ref_high,ref_text,flag,uncertain'

  it('parses report-level fields from the first row and each result', () => {
    const rows = [
      header.split(','),
      '2025-06-11,health_screening,Lab,,,Total Cholesterol,lipids,4.6,,mmol/L,,,5.3-6.2,,'.split(
        ',',
      ),
      '2025-06-11,health_screening,Lab,,,Creatinine,renal,60.6,,µmol/L,50.4,98.1,,,true'.split(
        ',',
      ),
    ]
    const r = parseMedicalCsv(rows)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.report.report_date).toBe('2025-06-11')
      expect(r.report.provider).toBe('Lab')
      expect(r.report.results).toHaveLength(2)
      expect(r.report.results[0]!.test_key).toBe('total_cholesterol')
      const creat = r.report.results[1]!
      expect(creat.test_key).toBe('creatinine')
      expect(creat.unit).toBe('umol/L') // label-normalized
      expect(creat.uncertain).toBe(true)
    }
  })

  it('errors on a missing required column', () => {
    const r = parseMedicalCsv([
      ['report_date', 'value_num'],
      ['2025-01-01', '1'],
    ])
    expect(r.ok).toBe(false)
  })
})
