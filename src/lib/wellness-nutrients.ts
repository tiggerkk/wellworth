import type { NutrientDri } from './wellness-dri'

/**
 * Nutrient-map math (docs/02-tech-spec.md). A NutrientMap is `{ nutrient_key: amount }`
 * relative to some basis (per 100 g or per serving). Pure functions.
 */
export type NutrientMap = Partial<Record<string, number>>

/** Narrow a JSONB value (from the DB) to a NutrientMap. */
export function asNutrientMap(value: unknown): NutrientMap {
  return value && typeof value === 'object' ? (value as NutrientMap) : {}
}

/** Grams represented by the food's storage basis: 100 for per_100g, else the serving's grams. */
export function basisGrams(nutrientBasis: string, servingGrams: number): number {
  return nutrientBasis === 'per_serving' ? servingGrams : 100
}

export interface ScaleInput {
  amount: number
  servingGrams: number
  basisGrams: number
}

/** Scale a per-basis nutrient map for a logged entry: value × (amount × servingGrams) / basisGrams. */
export function scaleNutrients(perBasis: NutrientMap, input: ScaleInput): NutrientMap {
  const factor = (input.amount * input.servingGrams) / input.basisGrams
  const out: NutrientMap = {}
  for (const [key, value] of Object.entries(perBasis)) {
    if (value != null) out[key] = value * factor
  }
  return out
}

/** Element-wise sum of several nutrient maps (e.g. a day's diary entries). */
export function sumNutrients(maps: NutrientMap[]): NutrientMap {
  const out: NutrientMap = {}
  for (const map of maps) {
    for (const [key, value] of Object.entries(map)) {
      if (value != null) out[key] = (out[key] ?? 0) + value
    }
  }
  return out
}

/** Net carbs = carbs − fiber (derived, not stored). No-op when carbs is absent. */
export function deriveNetCarbs(map: NutrientMap): NutrientMap {
  const carbs = map.carbs
  if (carbs == null) return map
  return { ...map, net_carbs: carbs - (map.fiber ?? 0) }
}

/** Percent of target, or null when there is no usable target. */
export function percentOfTarget(value: number, target: number | null): number | null {
  if (target == null || target <= 0) return null
  return (value / target) * 100
}

/**
 * Whether a value should render its bar red. Fires only for intake-based limits
 * ('total', 'cdrr', 'guidance') — never for supplemental/synthetic-only ULs, which a
 * normal diet routinely exceeds.
 */
export function isOverUpperLimit(value: number, dri: NutrientDri): boolean {
  if (dri.ul == null) return false
  if (dri.ulScope !== 'total' && dri.ulScope !== 'cdrr' && dri.ulScope !== 'guidance') {
    return false
  }
  return value > dri.ul
}

/**
 * Keep only keys present in the nutrient reference table — the JSONB key-validation
 * applied at write time (deferred from the schema for simplicity/perf).
 */
export function filterToKnownKeys(
  map: NutrientMap,
  knownKeys: ReadonlySet<string>,
): NutrientMap {
  const out: NutrientMap = {}
  for (const [key, value] of Object.entries(map)) {
    if (value != null && knownKeys.has(key)) out[key] = value
  }
  return out
}
