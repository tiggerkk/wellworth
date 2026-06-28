/**
 * Pure parsing for the monthly Fund CSV — the JPM "My Portfolio" export saved as CSV (see
 * `templates/fund-import-guide.md`). Turns parsed CSV rows into fund holdings ready to overwrite
 * a month's `fund` asset entries. No I/O, no FX (Total Value is already HKD in the export).
 *
 * Columns: `Fund Name, Account, Asset Class, Total Holdings, Base Currency, Avg. Unit Cost,
 * NAV Per Unit (As of Date), Total Cost, Total Value, Return Rate%, Profit/Loss`.
 * Notes: amounts carry an `HKD `/`USD ` prefix + thousands commas; the NAV cell embeds the
 * parenthesised as-of date (and often a newline) — `HKD 16.43\n(2026/06/25)`; per-unit figures
 * (Avg Unit Cost, NAV) are in the fund's Base Currency, while Total Cost / Total Value / P&L are
 * already in HKD. The export ends with a blank row + a "Downloaded on:" / disclaimer footer.
 */
import { CURRENCIES, type Currency } from './networth'

export interface ParsedFundRow {
  name: string
  asset_class: string
  /** Base Currency of the fund (per-unit figures are in this currency; the holding value is HKD). */
  currency: Currency
  units: number // Total Holdings
  avg_cost: number // base currency
  nav: number // base currency
  nav_as_of: string // YYYY/MM/DD, parsed from the NAV cell
  total_cost: number // HKD
  value_hkd: number // Total Value (HKD) — the holding's net-worth value
  return_rate: number // percent, e.g. -39.55
  pnl: number // HKD
}

export interface FundImportResult {
  rows: ParsedFundRow[]
  errors: string[]
}

const REQUIRED = [
  'Fund Name',
  'Base Currency',
  'NAV Per Unit (As of Date)',
  'Total Value',
]

/** Strip currency code / %, + signs / commas / quotes, then trim → a parseable number string. */
function num(raw: string): number {
  return Number(raw.replace(/[A-Za-z$%,+"]/g, '').trim())
}

/** Split a NAV cell `HKD 16.43(2026/06/25)` (optional space + embedded newline) into NAV + date. */
function splitNav(raw: string): { nav: number; asOf: string } {
  const dateMatch = /\(([^)]*)\)/.exec(raw)
  const asOf = (dateMatch?.[1] ?? '').trim()
  const navPart = raw.replace(/\([^)]*\)/, '')
  return { nav: num(navPart), asOf }
}

export function parseFundCsv(rows: string[][]): FundImportResult {
  const errors: string[] = []
  const out: ParsedFundRow[] = []

  if (rows.length === 0) return { rows: out, errors: ['The file is empty.'] }

  const header = rows[0]!.map((h) => h.trim())
  const missing = REQUIRED.filter((c) => !header.includes(c))
  if (missing.length > 0) {
    return { rows: out, errors: [`Missing required column(s): ${missing.join(', ')}.`] }
  }

  const idx = (name: string) => header.indexOf(name)
  const cell = (cells: string[], name: string) => (cells[idx(name)] ?? '').trim()

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!
    // The export ends with a blank row then a footer ("Downloaded on:", disclaimer). Stop there.
    if (cells.every((c) => c.trim() === '')) break

    const name = cell(cells, 'Fund Name')
    if (name === '') break // footer rows have no fund name
    const line = r + 1

    const currencyRaw = cell(cells, 'Base Currency').toUpperCase()
    if (!(CURRENCIES as readonly string[]).includes(currencyRaw)) {
      errors.push(
        `Row ${line} ("${name}"): Base Currency "${currencyRaw}" must be HKD, CNY, or USD.`,
      )
      continue
    }
    const currency = currencyRaw as Currency

    const value = num(cell(cells, 'Total Value'))
    if (!Number.isFinite(value)) {
      errors.push(`Row ${line} ("${name}"): Total Value is not a valid number.`)
      continue
    }

    const { nav, asOf } = splitNav(cell(cells, 'NAV Per Unit (As of Date)'))

    out.push({
      name,
      asset_class: cell(cells, 'Asset Class'),
      currency,
      units: num(cell(cells, 'Total Holdings')),
      avg_cost: num(cell(cells, 'Avg. Unit Cost')),
      nav,
      nav_as_of: asOf,
      total_cost: num(cell(cells, 'Total Cost')),
      value_hkd: value,
      return_rate: num(cell(cells, 'Return Rate%')),
      pnl: num(cell(cells, 'Profit/Loss')),
    })
  }

  return { rows: out, errors }
}
