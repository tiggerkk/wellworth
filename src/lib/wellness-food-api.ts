import type { NutrientMap } from './wellness-nutrients'
import { toUsdaWildcardQuery } from './wellness-food-search'
import { searchZhVariants } from './zh-query'
import { GRAMS_PER_OZ, GRAMS_PER_LB } from './wellness-units'

/**
 * USDA FoodData Central client + nutrient mapping. Called directly from the browser with
 * VITE_USDA_API_KEY (the tech spec designates it a browser var). Amounts are normalized to
 * per 100 g — Foundation/SR Legacy/Survey already report per 100 g, and Branded foods in
 * FDC store per-100g values in foodNutrients too. We map on the stable INFOODS
 * `nutrient.number` (string), never the free-text name. Units already match ours.
 */

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

/** A food from USDA or Open Food Facts, normalized for Food Detail + caching into `food`. */
export interface ExternalFood {
  source: 'usda' | 'off'
  externalId: string
  name: string
  brand: string | null
  nutrientBasis: 'per_100g'
  nutrients: NutrientMap
  servingText: string | null
  servingGrams: number | null
}

// USDA nutrient.number → our key. (energy 208 = kcal, NOT kJ; vitamin_a 320 = µg RAE;
// folate 435 = µg DFE; vitamin_d 328 = µg; copper 312 = mg; iodine 314 = µg.)
const USDA_NUTRIENT_MAP: Record<string, string> = {
  '208': 'energy',
  '255': 'water',
  '221': 'alcohol',
  '262': 'caffeine',
  '203': 'protein',
  '204': 'fat',
  '205': 'carbs',
  '291': 'fiber',
  '209': 'starch',
  '269': 'sugars',
  '539': 'added_sugars',
  '212': 'fructose',
  '211': 'glucose',
  '213': 'lactose',
  '214': 'maltose',
  '210': 'sucrose',
  '287': 'galactose',
  '606': 'saturated',
  '645': 'monounsaturated',
  '646': 'polyunsaturated',
  '605': 'trans',
  '601': 'cholesterol',
  '621': 'dha',
  '629': 'epa',
  '619': 'ala',
  '618': 'linoleic',
  '620': 'arachidonic',
  '608': 'palmitic',
  '609': 'stearic',
  '617': 'oleic',
  '320': 'vitamin_a',
  '401': 'vitamin_c',
  '328': 'vitamin_d',
  '323': 'vitamin_e',
  '430': 'vitamin_k',
  '404': 'b1',
  '405': 'b2',
  '406': 'b3',
  '410': 'b5',
  '415': 'b6',
  '418': 'b12',
  '435': 'folate',
  '416': 'b7',
  '421': 'choline',
  '301': 'calcium',
  '312': 'copper',
  '314': 'iodine',
  '303': 'iron',
  '304': 'magnesium',
  '315': 'manganese',
  '305': 'phosphorus',
  '306': 'potassium',
  '317': 'selenium',
  '307': 'sodium',
  '309': 'zinc',
  '512': 'histidine',
  '503': 'isoleucine',
  '504': 'leucine',
  '505': 'lysine',
  '506': 'methionine',
  '508': 'phenylalanine',
  '502': 'threonine',
  '501': 'tryptophan',
  '510': 'valine',
}

// Loose shapes for the USDA JSON (search uses nutrientNumber/value; detail uses nutrient.number/amount).
interface UsdaFoodNutrient {
  nutrient?: { number?: string }
  amount?: number
  nutrientNumber?: string
  value?: number
}
interface UsdaFood {
  fdcId: number
  description?: string
  dataType?: string
  brandName?: string
  brandOwner?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: UsdaFoodNutrient[]
}

/** Map a USDA food's nutrients (per 100 g) to our NutrientMap. Exported for testing. */
export function mapUsdaNutrients(food: UsdaFood): NutrientMap {
  const out: NutrientMap = {}
  for (const fn of food.foodNutrients ?? []) {
    const number = fn.nutrient?.number ?? fn.nutrientNumber
    const amount = fn.amount ?? fn.value
    const key = number ? USDA_NUTRIENT_MAP[number] : undefined
    if (key && typeof amount === 'number' && Number.isFinite(amount)) {
      out[key] = amount
    }
  }
  return out
}

/** Serving label shown on a result's second line — USDA whole foods are stored per 100 g. Shared by
 * the Add-Food list, the importer preview, and the food search overlay. */
export function externalFoodServing(f: ExternalFood): string {
  if (f.servingText) return f.servingText
  if (f.servingGrams) return `${f.servingGrams} g`
  return '100 g'
}

/**
 * USDA's serving size in grams. The API reports `servingSize` in `servingSizeUnit`, usually 'g'
 * but sometimes a weight unit like 'oz'/'lb' (e.g. "2 oz" pasta). We convert weight units to grams
 * so the serving survives into Food Detail instead of being dropped (which then fell back to 100 g).
 * Volume units (ml/fl oz) need a density we don't have, so they stay null — the user can add a
 * custom serving instead. Rounded to 0.1 g (nutrient math is gram-based; the label shows grams).
 */
function usdaServingGrams(food: UsdaFood): number | null {
  const n = food.servingSize
  if (n == null || !Number.isFinite(n)) return null
  let grams: number
  switch ((food.servingSizeUnit ?? '').toLowerCase()) {
    case 'g':
      grams = n
      break
    case 'oz':
      grams = n * GRAMS_PER_OZ
      break
    case 'lb':
      grams = n * GRAMS_PER_LB
      break
    default:
      return null
  }
  return Math.round(grams * 10) / 10
}

function toExternalFood(food: UsdaFood): ExternalFood {
  return {
    source: 'usda',
    externalId: String(food.fdcId),
    name: food.description ?? 'Unknown food',
    brand: food.brandName ?? food.brandOwner ?? null,
    nutrientBasis: 'per_100g',
    nutrients: mapUsdaNutrients(food),
    servingText: food.householdServingFullText ?? null,
    servingGrams: usdaServingGrams(food),
  }
}

function apiKey(): string {
  const key = import.meta.env.VITE_USDA_API_KEY
  if (!key) {
    throw new Error('USDA food search is not configured — add VITE_USDA_API_KEY to .env.')
  }
  return key
}

/**
 * One USDA search call. Uses POST with a JSON body — the GET endpoint rejects a `dataType`
 * containing "Survey (FNDDS)" (the space/parens 400s), whereas POST accepts the array.
 */
async function usdaSearch(
  query: string,
  dataType: string[],
  pageSize: number,
): Promise<ExternalFood[]> {
  const res = await fetch(
    `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(apiKey())}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, pageSize, dataType }),
    },
  )
  if (!res.ok) throw new Error(`USDA search failed (${res.status})`)
  const json = (await res.json()) as { foods?: UsdaFood[] }
  return (json.foods ?? []).map(toExternalFood)
}

/** Identical branded products dedupe by name + brand (see searchFoods). */
const MAX_BRANDED_RESULTS = 15

/**
 * Search USDA foods for the Add-Food list.
 *
 * The whole-food databases (Foundation / SR Legacy / Survey FNDDS) use "Food, modifier"
 * descriptions ("Blueberries, raw", "Muffins, blueberry") and carry full nutrient profiles —
 * exactly what we want to surface. Branded foods, however, number in the thousands per term
 * (8000+ for "blueberries") and, ranked by USDA's relevance, flood the first page with
 * identical exact-name products, burying every "…, raw"/"Muffins, blueberry" entry below them.
 *
 * So we query the two pools separately and always include the whole foods, then collapse the
 * branded duplicates (same name + brand) and cap them. The caller sorts the merged list by how
 * well each name matches the query, so this only needs to guarantee variety, not order.
 */
export async function searchFoods(query: string): Promise<ExternalFood[]> {
  // CJK queries are searched in both Simplified and HK-Traditional, merged + de-duped on
  // source+id, so either input variant finds the food (see `searchZhVariants`).
  return searchZhVariants(query, searchFoodsOne, (f) => `${f.source}:${f.externalId}`)
}

async function searchFoodsOne(trimmed: string): Promise<ExternalFood[]> {
  // Wildcard the last word so partial/plural input ("blueberr", "blueberrie") still matches; the
  // result scorer in the UI re-filters to the typed term, so over-broad recall is harmless.
  const wild = toUsdaWildcardQuery(trimmed)
  const [whole, branded] = await Promise.all([
    usdaSearch(wild, ['Foundation', 'SR Legacy', 'Survey (FNDDS)'], 40),
    usdaSearch(wild, ['Branded'], 40),
  ])

  const out = [...whole]
  const brandedSeen = new Set<string>()
  for (const f of branded) {
    if (brandedSeen.size >= MAX_BRANDED_RESULTS) break
    const key = `${f.name.toLowerCase()}|${(f.brand ?? '').toLowerCase()}`
    if (brandedSeen.has(key)) continue
    brandedSeen.add(key)
    out.push(f)
  }
  return out
}

/** Fetch one USDA food's full nutrient profile. */
export async function getUsdaFood(fdcId: string): Promise<ExternalFood> {
  const params = new URLSearchParams({ api_key: apiKey() })
  const res = await fetch(`${USDA_BASE}/food/${fdcId}?${params.toString()}`)
  if (!res.ok) throw new Error(`USDA lookup failed (${res.status})`)
  const json = (await res.json()) as UsdaFood
  return toExternalFood(json)
}
