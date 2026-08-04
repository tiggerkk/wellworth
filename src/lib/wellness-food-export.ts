/**
 * Pure row-building for the Wellness Food CSV export — the inverse of `wellness-food-import.ts`'s
 * `parseFoodCsv`. Core column spec matches exactly:
 * `name,type,is_custom,is_favorite,nutrient_basis,serving1_name,serving1_grams,serving2_name,
 * serving2_grams,serving3_name,serving3_grams,default_serving`, followed by every nutrient column
 * in canonical reference order (`nutrient.category`, then `nutrient.sort_order` — pass via
 * `nutrientKeysInOrder`, e.g. from `getAllNutrients()`) — the same full column set as
 * `templates/wellness-foods-template.csv`, so the exported file can also be hand-edited to add new
 * rows before re-importing, without needing to look up the template separately.
 *
 * `is_custom` is exported `true` only for `source==='custom'` — a USDA-matched food is left
 * blank, so re-importing lets it re-resolve against USDA (its nutrient cells are exported blank
 * too, since the importer ignores nutrients for a non-custom row regardless of the CSV).
 *
 * A food's servings are exported into the CSV's 3 fixed slots, ordered by `grams` ascending (same
 * order as `listServings`); a food with more than 3 servings only exports its first 3 — the CSV
 * format itself has no room for more. `default_serving` is the *name* of the food's currently
 * selected default (resolved by `default_serving_id`), so it can be matched back by name on
 * re-import.
 *
 * Rows are sorted by `name` ascending. No I/O.
 */
import type { Tables } from '../types/database'
import type { NutrientMap } from './wellness-nutrients'

type FoodRow = Tables<'food'>
type ServingRow = Tables<'serving'>

const CORE_HEADER = [
  'name',
  'type',
  'is_custom',
  'is_favorite',
  'nutrient_basis',
  'serving1_name',
  'serving1_grams',
  'serving2_name',
  'serving2_grams',
  'serving3_name',
  'serving3_grams',
  'default_serving',
]

const MAX_EXPORTED_SERVINGS = 3

export function buildFoodExportRows(
  foods: FoodRow[],
  servingsByFoodId: Map<string, ServingRow[]>,
  nutrientKeysInOrder: string[],
): string[][] {
  const rows: string[][] = [[...CORE_HEADER, ...nutrientKeysInOrder]]

  const sorted = [...foods].sort((a, b) => a.name.localeCompare(b.name))
  for (const f of sorted) {
    const servings = (servingsByFoodId.get(f.id) ?? []).slice(0, MAX_EXPORTED_SERVINGS)
    const defaultName = servings.find((s) => s.id === f.default_serving_id)?.name ?? ''
    const isCustom = f.source === 'custom'

    const servingCells: string[] = []
    for (let i = 0; i < MAX_EXPORTED_SERVINGS; i++) {
      const s = servings[i]
      servingCells.push(s?.name ?? '', s ? String(s.grams) : '')
    }

    const nutrients = isCustom ? ((f.nutrients ?? {}) as NutrientMap) : {}
    const nutrientCells = nutrientKeysInOrder.map((key) => {
      const v = nutrients[key]
      return v == null ? '' : String(v)
    })

    rows.push([
      f.name,
      f.type,
      isCustom ? 'true' : '',
      f.is_favorite ? 'true' : '',
      f.nutrient_basis,
      ...servingCells,
      defaultName,
      ...nutrientCells,
    ])
  }
  return rows
}
