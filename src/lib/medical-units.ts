/**
 * Cross-provider **unit normalization** for imported medical results (docs/02-tech-spec.md →
 * "Unit normalization"). Each result is converted to its test's canonical `default_unit`: the value
 * (and numeric ref range) is scaled, the unit string is set to the canonical one, `normalized` is
 * flagged true, and the **printed original is preserved**. This amends the global "never recompute"
 * rule into an explicit, flagged, reversible transform — the app still never invents/derives clinical
 * values. Pure + unit-tested; applied by the importer (`medical-import.ts`). Manual entry skips it.
 */
import { labTestByKey } from './medical'

/** Collapse a printed unit to a comparison key: lowercased, spaces removed, µ/μ → u, synonyms folded. */
function unitKey(u: string | null | undefined): string {
  if (!u) return ''
  let s = u.trim().toLowerCase().replace(/[µμ]/g, 'u').replace(/\s+/g, '')
  const ALIASES: Record<string, string> = {
    'internationalunit/l': 'u/l',
    'iu/l': 'u/l', // enzyme IU/L ≡ U/L (RF's IU/mL stays distinct — different denominator)
    'k/mcl': 'k/ul',
    'x10^9/l': 'k/ul',
    'm/mcl': 'm/ul',
    'x10^12/l': 'm/ul',
    'ug/l': 'ng/ml', // µg/L ≡ ng/mL
    'ku/l': 'u/ml', // kU/L ≡ U/mL
    'ummol/l': 'umol/l', // a provider typo for µmol/L
  }
  s = ALIASES[s] ?? s
  return s
}

/** Scale factors between unit keys where the numeric value differs (factor 1 pairs are label-only). */
const FACTORS: Record<string, number> = {
  'g/l->g/dl': 0.1,
  'g/dl->g/l': 10,
  'umol/l->mmol/l': 0.001,
  'mmol/l->umol/l': 1000,
}

/** Round away binary-float noise from a scale multiply (e.g. 148 × 0.1) without lying about precision. */
function tidy(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

export interface NormalizeInput {
  value_num: number | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  test_key: string | null
}

export interface NormalizeOutput {
  value_num: number | null
  unit: string | null
  ref_low: number | null
  ref_high: number | null
  normalized: boolean
  value_num_original: number | null
  unit_original: string | null
}

/**
 * Normalize a result toward its test's canonical `default_unit`. Returns the row unchanged
 * (`normalized=false`, no original captured) when there's nothing to convert: no `test_key`, the test
 * has no canonical unit, the printed unit is blank, the units already match exactly, or the unit pair
 * is unrecognised (we never force an unknown conversion).
 */
export function normalizeResult(input: NormalizeInput): NormalizeOutput {
  const unchanged: NormalizeOutput = {
    value_num: input.value_num,
    unit: input.unit,
    ref_low: input.ref_low,
    ref_high: input.ref_high,
    normalized: false,
    value_num_original: null,
    unit_original: null,
  }

  const canonical = input.test_key
    ? (labTestByKey.get(input.test_key)?.default_unit ?? null)
    : null
  if (!canonical || !input.unit || input.unit.trim() === '') return unchanged
  if (input.unit === canonical) return unchanged // already canonical, exact

  const from = unitKey(input.unit)
  const to = unitKey(canonical)
  if (from === '' || to === '') return unchanged

  const scale = (v: number | null, f: number): number | null =>
    v == null ? null : tidy(v * f)

  // Same dimension → label-only canonicalization (value unchanged, unit string normalized).
  if (from === to) {
    return {
      value_num: input.value_num,
      unit: canonical,
      ref_low: input.ref_low,
      ref_high: input.ref_high,
      normalized: true,
      value_num_original: input.value_num,
      unit_original: input.unit,
    }
  }

  const factor = FACTORS[`${from}->${to}`]
  if (factor == null) return unchanged // unrecognised pair — keep as printed, don't guess

  return {
    value_num: scale(input.value_num, factor),
    unit: canonical,
    ref_low: scale(input.ref_low, factor),
    ref_high: scale(input.ref_high, factor),
    normalized: true,
    value_num_original: input.value_num,
    unit_original: input.unit,
  }
}
