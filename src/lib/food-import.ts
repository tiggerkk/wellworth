/**
 * Pure mapping + validation for the bulk food/supplement CSV import (see
 * `templates/custom-foods-import-guide.md`). Turns parsed CSV rows into food records the importer then
 * matches against USDA (`ImportFoodsSheet` → `saveImportedFoods`), collecting blocking errors and
 * non-blocking warnings for a preview. No I/O. NB: `is_favorite` is parsed but the importer saves
 * **every** row as a favorite (USDA foods only persist when favorited), so the column is informational.
 */
import type { NutrientMap } from './nutrients'

const CORE_COLUMNS = new Set([
  'name',
  'type',
  'nutrient_basis',
  'is_favorite',
  'serving1_name',
  'serving1_grams',
  'serving2_name',
  'serving2_grams',
  'serving3_name',
  'serving3_grams',
])

// Present in the nutrient reference but derived at display time (carbs − fiber), so ignored on import.
const IGNORED_NUTRIENT_KEYS = new Set(['net_carbs'])

export interface ImportFoodRecord {
  name: string
  type: 'food' | 'supplement'
  nutrient_basis: 'per_100g' | 'per_serving'
  is_favorite: boolean
  nutrients: NutrientMap
  servings: { name: string; grams: number }[]
}

export interface ImportParseResult {
  records: ImportFoodRecord[]
  errors: string[]
  warnings: string[]
}

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase()
  if (v === '') return false
  if (['true', '1', 'yes', 'y'].includes(v)) return true
  if (['false', '0', 'no', 'n'].includes(v)) return false
  return null
}

/**
 * @param rows Parsed CSV (row 0 = header). @param knownNutrientKeys keys in the `nutrient` table.
 */
export function parseFoodCsv(
  rows: string[][],
  knownNutrientKeys: ReadonlySet<string>,
): ImportParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const records: ImportFoodRecord[] = []

  if (rows.length === 0) {
    return { records, errors: ['The file is empty.'], warnings }
  }

  const header = rows[0]!.map((h) => h.trim())
  if (!header.includes('name')) {
    return {
      records,
      errors: ['Missing required "name" column in the header row.'],
      warnings,
    }
  }

  // Classify each header column once.
  const nutrientCols: { index: number; key: string }[] = []
  const unknown: string[] = []
  header.forEach((key, index) => {
    if (key === '' || CORE_COLUMNS.has(key)) return
    if (IGNORED_NUTRIENT_KEYS.has(key)) {
      warnings.push(`Column "${key}" is derived automatically and was ignored.`)
    } else if (knownNutrientKeys.has(key)) {
      nutrientCols.push({ index, key })
    } else {
      unknown.push(key)
    }
  })
  if (unknown.length > 0) {
    warnings.push(`Unknown column(s) ignored: ${unknown.join(', ')}.`)
  }

  const col = (cells: string[], name: string): string => {
    const idx = header.indexOf(name)
    return idx === -1 ? '' : (cells[idx] ?? '').trim()
  }

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!
    if (cells.every((c) => c.trim() === '')) continue // skip blank lines
    const line = r + 1 // 1-based spreadsheet row (header is line 1)

    const name = col(cells, 'name')
    if (name === '') {
      errors.push(`Row ${line}: missing name — skipped.`)
      continue
    }

    const typeRaw = col(cells, 'type').toLowerCase() || 'food'
    if (typeRaw !== 'food' && typeRaw !== 'supplement') {
      errors.push(`Row ${line} ("${name}"): type must be food or supplement — skipped.`)
      continue
    }

    const basisRaw = col(cells, 'nutrient_basis').toLowerCase() || 'per_100g'
    if (basisRaw !== 'per_100g' && basisRaw !== 'per_serving') {
      errors.push(
        `Row ${line} ("${name}"): nutrient_basis must be per_100g or per_serving — skipped.`,
      )
      continue
    }

    const fav = parseBool(col(cells, 'is_favorite'))
    if (fav === null) {
      warnings.push(
        `Row ${line} ("${name}"): is_favorite not true/false — treated as false.`,
      )
    }

    const servings: { name: string; grams: number }[] = []
    for (let s = 1; s <= 3; s++) {
      const sName = col(cells, `serving${s}_name`)
      const sGramsRaw = col(cells, `serving${s}_grams`)
      if (sName === '' && sGramsRaw === '') continue
      if (sName === '' || sGramsRaw === '') {
        warnings.push(
          `Row ${line} ("${name}"): serving ${s} needs both a name and grams — skipped.`,
        )
        continue
      }
      const grams = Number(sGramsRaw)
      if (!Number.isFinite(grams) || grams <= 0) {
        warnings.push(
          `Row ${line} ("${name}"): serving ${s} grams "${sGramsRaw}" is invalid — skipped.`,
        )
        continue
      }
      servings.push({ name: sName, grams })
    }

    const nutrients: NutrientMap = {}
    for (const { index, key } of nutrientCols) {
      const raw = (cells[index] ?? '').trim()
      if (raw === '') continue
      const num = Number(raw)
      if (!Number.isFinite(num)) {
        warnings.push(
          `Row ${line} ("${name}"): ${key} "${raw}" is not a number — skipped.`,
        )
        continue
      }
      if (num < 0) {
        warnings.push(`Row ${line} ("${name}"): ${key} is negative — skipped.`)
        continue
      }
      nutrients[key] = num
    }

    records.push({
      name,
      type: typeRaw,
      nutrient_basis: basisRaw,
      is_favorite: fav === true,
      nutrients,
      servings,
    })
  }

  return { records, errors, warnings }
}
