/**
 * Pure parsing + validation for the Net Worth CSV import (see
 * `templates/networth-import-guide.md`). Turns parsed CSV rows into asset rows ready for
 * `saveSnapshotEntries`, collecting blocking errors for a preview. No I/O, no FX (the screen
 * fetches rates and computes `value_base`).
 *
 * Column spec: `asset_type,name,currency,value_native,detail1_key,detail1_value,…` — any number of
 * `detailN_key`/`detailN_value` pairs are accepted and stored as-is in `details`.
 */
import {
  NETWORTH_CURRENCIES,
  type AssetType,
  type NetWorthCurrency,
} from '../constants/networth'

const REQUIRED_COLUMNS = ['asset_type', 'name', 'currency', 'value_native']

/**
 * The manual importer handles only the hand-entered asset types. Fund rows come from the JPM
 * monthly CSV (Monthly Entry → Fund) and insurance rows are generated from the policy catalogue,
 * so both are rejected here to keep their dedicated pipelines authoritative.
 */
const MANUAL_ASSET_TYPES = [
  'cash',
  'time_deposit',
  'stock',
  'retirement',
  'property',
] as const

export interface ParsedAssetRow {
  asset_type: AssetType
  name: string
  currency: NetWorthCurrency
  value_native: number
  details: Record<string, string>
}

export interface NetWorthImportResult {
  rows: ParsedAssetRow[]
  errors: string[]
  warnings: string[]
}

/** Strip thousands-separator commas and any quotes, then trim — e.g. `"8,466,568.80"` → `8466568.80`. */
export function stripNumber(raw: string): string {
  return raw.replace(/[",]/g, '').trim()
}

export function parseNetWorthCsv(rows: string[][]): NetWorthImportResult {
  const errors: string[] = []
  const warnings: string[] = []
  const out: ParsedAssetRow[] = []

  if (rows.length === 0) {
    return { rows: out, errors: ['The file is empty.'], warnings }
  }

  const header = rows[0]!.map((h) => h.trim())
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) {
    return {
      rows: out,
      errors: [`Missing required column(s): ${missing.join(', ')}.`],
      warnings,
    }
  }

  // Detail key/value column index pairs (any N).
  const detailPairs: { keyIdx: number; valueIdx: number }[] = []
  header.forEach((h, i) => {
    const m = /^detail(\d+)_key$/.exec(h)
    if (m) {
      const valueIdx = header.indexOf(`detail${m[1]}_value`)
      if (valueIdx !== -1) detailPairs.push({ keyIdx: i, valueIdx })
    }
  })

  const col = (cells: string[], name: string): string => {
    const idx = header.indexOf(name)
    return idx === -1 ? '' : (cells[idx] ?? '').trim()
  }

  const assetSet = new Set<string>(MANUAL_ASSET_TYPES)
  const currencySet = new Set<string>(NETWORTH_CURRENCIES)

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!
    if (cells.every((c) => c.trim() === '')) continue // skip blank lines
    const line = r + 1 // 1-based spreadsheet row (header is line 1)

    const name = col(cells, 'name')
    if (name === '') {
      errors.push(`Row ${line}: missing name — skipped.`)
      continue
    }

    const assetRaw = col(cells, 'asset_type')
    const assetType = assetRaw.toLowerCase()
    if (!assetSet.has(assetType)) {
      const hint =
        assetType === 'fund' || assetType === 'mutual_fund' || assetType === 'insurance'
          ? ` — ${assetType === 'insurance' ? 'insurance is generated from the policy catalogue' : 'funds import from the JPM monthly CSV'}, not this importer`
          : ''
      errors.push(
        `Row ${line} ("${name}"): asset_type "${assetRaw}" is not valid${hint} — skipped.`,
      )
      continue
    }

    const currencyRaw = col(cells, 'currency')
    const currency = currencyRaw.toUpperCase()
    if (!currencySet.has(currency)) {
      errors.push(
        `Row ${line} ("${name}"): currency "${currencyRaw}" must be HKD, CNY, or USD — skipped.`,
      )
      continue
    }

    const valueRaw = col(cells, 'value_native')
    const value = Number(stripNumber(valueRaw))
    if (stripNumber(valueRaw) === '' || !Number.isFinite(value) || value < 0) {
      errors.push(
        `Row ${line} ("${name}"): value_native "${valueRaw}" is not a valid number — skipped.`,
      )
      continue
    }

    const details: Record<string, string> = {}
    for (const { keyIdx, valueIdx } of detailPairs) {
      const key = (cells[keyIdx] ?? '').trim()
      if (key === '') continue
      details[key] = stripNumber(cells[valueIdx] ?? '')
    }

    out.push({
      asset_type: assetType as AssetType,
      name,
      currency: currency as NetWorthCurrency,
      value_native: value,
      details,
    })
  }

  return { rows: out, errors, warnings }
}
