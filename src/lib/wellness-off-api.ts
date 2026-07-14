import type { NutrientMap } from './wellness-nutrients'
import type { ExternalFood } from './wellness-food-api'

/**
 * Open Food Facts barcode lookup + nutrient mapping. Called directly from the browser.
 * OFF stores every `*_100g` value in BASE SI units (grams) — including vitamins/minerals —
 * so most map with a scale factor to our mg/µg. Energy is the exception (kcal). All fields
 * are optional/sparse, so each is read defensively.
 */

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2'

// OFF nutriment key (without the `_100g` suffix) → { ourKey, factor to OUR unit }.
const OFF_NUTRIENT_MAP: { off: string; key: string; factor: number }[] = [
  { off: 'proteins', key: 'protein', factor: 1 },
  { off: 'carbohydrates', key: 'carbs', factor: 1 },
  { off: 'fiber', key: 'fiber', factor: 1 },
  { off: 'sugars', key: 'sugars', factor: 1 },
  { off: 'added-sugars', key: 'added_sugars', factor: 1 },
  { off: 'starch', key: 'starch', factor: 1 },
  { off: 'fructose', key: 'fructose', factor: 1 },
  { off: 'glucose', key: 'glucose', factor: 1 },
  { off: 'lactose', key: 'lactose', factor: 1 },
  { off: 'maltose', key: 'maltose', factor: 1 },
  { off: 'sucrose', key: 'sucrose', factor: 1 },
  { off: 'fat', key: 'fat', factor: 1 },
  { off: 'saturated-fat', key: 'saturated', factor: 1 },
  { off: 'monounsaturated-fat', key: 'monounsaturated', factor: 1 },
  { off: 'polyunsaturated-fat', key: 'polyunsaturated', factor: 1 },
  { off: 'omega-3-fat', key: 'omega3', factor: 1 },
  { off: 'omega-6-fat', key: 'omega6', factor: 1 },
  { off: 'trans-fat', key: 'trans', factor: 1 },
  { off: 'alpha-linolenic-acid', key: 'ala', factor: 1 },
  { off: 'eicosapentaenoic-acid', key: 'epa', factor: 1 },
  { off: 'docosahexaenoic-acid', key: 'dha', factor: 1 },
  { off: 'linoleic-acid', key: 'linoleic', factor: 1 },
  { off: 'arachidonic-acid', key: 'arachidonic', factor: 1 },
  { off: 'water', key: 'water', factor: 1 },
  { off: 'alcohol', key: 'alcohol', factor: 1 },
  { off: 'caffeine', key: 'caffeine', factor: 1000 }, // g → mg
  { off: 'cholesterol', key: 'cholesterol', factor: 1000 }, // g → mg
  { off: 'sodium', key: 'sodium', factor: 1000 }, // g → mg (salt handled separately)
  { off: 'calcium', key: 'calcium', factor: 1000 },
  { off: 'iron', key: 'iron', factor: 1000 },
  { off: 'magnesium', key: 'magnesium', factor: 1000 },
  { off: 'phosphorus', key: 'phosphorus', factor: 1000 },
  { off: 'potassium', key: 'potassium', factor: 1000 },
  { off: 'zinc', key: 'zinc', factor: 1000 },
  { off: 'copper', key: 'copper', factor: 1000 },
  { off: 'manganese', key: 'manganese', factor: 1000 },
  { off: 'fluoride', key: 'fluoride', factor: 1000 },
  { off: 'chloride', key: 'chloride', factor: 1000 },
  { off: 'selenium', key: 'selenium', factor: 1_000_000 }, // g → µg
  { off: 'iodine', key: 'iodine', factor: 1_000_000 },
  { off: 'chromium', key: 'chromium', factor: 1_000_000 },
  { off: 'molybdenum', key: 'molybdenum', factor: 1_000_000 },
  { off: 'vitamin-a', key: 'vitamin_a', factor: 1_000_000 },
  { off: 'vitamin-c', key: 'vitamin_c', factor: 1000 },
  { off: 'vitamin-d', key: 'vitamin_d', factor: 1_000_000 },
  { off: 'vitamin-e', key: 'vitamin_e', factor: 1000 },
  { off: 'vitamin-k', key: 'vitamin_k', factor: 1_000_000 },
  { off: 'vitamin-b1', key: 'b1', factor: 1000 },
  { off: 'vitamin-b2', key: 'b2', factor: 1000 },
  { off: 'vitamin-pp', key: 'b3', factor: 1000 },
  { off: 'pantothenic-acid', key: 'b5', factor: 1000 },
  { off: 'vitamin-b6', key: 'b6', factor: 1000 },
  { off: 'vitamin-b12', key: 'b12', factor: 1_000_000 },
  { off: 'vitamin-b9', key: 'folate', factor: 1_000_000 },
  { off: 'biotin', key: 'b7', factor: 1_000_000 },
  { off: 'choline', key: 'choline', factor: 1000 },
]

type OffNutriments = Record<string, number | string | undefined>

function num(v: number | string | undefined): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

/** Map an OFF `nutriments` object (per-100g, grams) to our NutrientMap. Exported for testing. */
export function mapOffNutriments(nutriments: OffNutriments): NutrientMap {
  const out: NutrientMap = {}

  // Energy: prefer kcal; fall back to kJ × 0.239.
  const kcal = num(nutriments['energy-kcal_100g'])
  const kj = num(nutriments['energy-kj_100g']) ?? num(nutriments['energy_100g'])
  if (kcal != null) out.energy = kcal
  else if (kj != null) out.energy = kj * 0.239

  for (const { off, key, factor } of OFF_NUTRIENT_MAP) {
    const v = num(nutriments[`${off}_100g`])
    if (v != null) out[key] = v * factor
  }

  // Sodium: derive from salt when sodium isn't given directly (sodium = salt / 2.5).
  if (out.sodium == null) {
    const salt = num(nutriments['salt_100g'])
    if (salt != null) out.sodium = (salt / 2.5) * 1000
  }

  return out
}

interface OffProduct {
  product_name?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: OffNutriments
}

/** Look up a product by barcode. Returns null when OFF has no record. */
export async function lookupBarcode(barcode: string): Promise<ExternalFood | null> {
  const fields = 'product_name,brands,serving_size,serving_quantity,nutriments'
  const res = await fetch(
    `${OFF_BASE}/product/${encodeURIComponent(barcode)}.json?fields=${fields}`,
  )
  if (!res.ok) throw new Error(`Open Food Facts lookup failed (${res.status})`)
  const json = (await res.json()) as { status?: number; product?: OffProduct }
  if (json.status !== 1 || !json.product) return null

  const p = json.product
  return {
    source: 'off',
    externalId: barcode,
    name: p.product_name?.trim() || `Barcode ${barcode}`,
    brand: p.brands?.split(',')[0]?.trim() ?? null,
    nutrientBasis: 'per_100g',
    nutrients: mapOffNutriments(p.nutriments ?? {}),
    servingText: p.serving_size ?? null,
    servingGrams: num(p.serving_quantity) ?? null,
  }
}
