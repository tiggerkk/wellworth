/**
 * Pure parsing for the two insurance CSV imports (see `templates/insurance-import-guide.md`):
 *
 *  1. BULK SEED — the wide spreadsheet (`templates/Insurance.xlsx` saved as CSV). One 4-column
 *     block per policy (`Policy Year, Total Premium Paid, Cash Value, Surrender Gain %/Yr`) with
 *     a shared `Age` in column A. Four header rows: provider (merged → carried forward across
 *     blank cells), policy name, `number: start_date`, and the repeating sub-header. Blocks with
 *     no policy number are skipped; trailing total columns (sub-header USD/HKD) are dropped.
 *
 *  2. SINGLE POLICY — a narrow one-policy file: a tiny key/value header (Provider, Policy Number,
 *     optional Policy Name + Start Date), then the `Age, Policy Year, Total Premium Paid,
 *     Cash Value, Surrender Gain %/Yr` table. Surrender Gain is ignored (the app recomputes it);
 *     currency + effective date are NOT in the file (set on the New/Edit Insurance screen).
 *
 * No I/O. Only real (printed) premium+cash points are emitted — carry-forward is a display rule.
 */
import {
  PROVIDER_DEFAULT_CURRENCY,
  type InsuranceProvider,
  type SchedulePoint,
} from './networth'

export interface ParsedPolicy {
  provider: InsuranceProvider
  policy_number: string
  policy_name: string
  start_date: string | null // ISO yyyy-mm-dd
  currency: 'HKD' | 'USD'
  first_year: number
  points: SchedulePoint[]
}

export interface InsuranceBulkResult {
  policies: ParsedPolicy[]
  errors: string[]
  warnings: string[]
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

/** Parse a loose date like `Aug 6, 2014` → `2014-08-06` (null if unrecognized). */
export function parseLooseDate(raw: string): string | null {
  const m = /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(raw.trim())
  if (!m) return null
  const month = MONTHS[m[1]!.slice(0, 3).toLowerCase()]
  if (!month) return null
  const day = Number(m[2])
  const year = Number(m[3])
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Map a provider label to its key (null if not a known provider). */
export function providerKey(raw: string): InsuranceProvider | null {
  const v = raw.trim().toLowerCase()
  if (v === 'chubb') return 'chubb'
  if (v === 'boc') return 'boc'
  if (v === 'manulife') return 'manulife'
  return null
}

function num(raw: string | undefined): number {
  return Number((raw ?? '').replace(/[",]/g, '').trim())
}

function isBlank(raw: string | undefined): boolean {
  return (raw ?? '').trim() === ''
}

/** Split `2140144838: Aug 6, 2014` → number + start date (number is everything before the 1st colon). */
function splitNumberDate(cell: string): { number: string; startDate: string | null } {
  const colon = cell.indexOf(':')
  if (colon === -1) return { number: cell.trim(), startDate: null }
  return {
    number: cell.slice(0, colon).trim(),
    startDate: parseLooseDate(cell.slice(colon + 1)),
  }
}

/**
 * Parse the wide bulk-seed CSV. `currencyByProvider` is the per-provider currency confirmed at
 * import (defaults to PROVIDER_DEFAULT_CURRENCY).
 */
export function parseInsuranceBulkCsv(
  rows: string[][],
  currencyByProvider: Partial<Record<InsuranceProvider, 'HKD' | 'USD'>> = {},
): InsuranceBulkResult {
  const errors: string[] = []
  const warnings: string[] = []
  const policies: ParsedPolicy[] = []

  if (rows.length < 5) {
    return {
      policies,
      errors: ['The file does not have the expected header rows.'],
      warnings,
    }
  }

  const providerRow = rows[0]!
  const nameRow = rows[1]!
  const numberRow = rows[2]!
  const subHeaderRow = rows[3]!
  const dataRows = rows.slice(4)

  const colCount = Math.max(
    providerRow.length,
    nameRow.length,
    numberRow.length,
    subHeaderRow.length,
  )

  // Carry the provider label forward across blank cells (CSV flattens merged cells).
  let carriedProvider: InsuranceProvider | null = null

  for (let c = 1; c + 2 < colCount; c += 4) {
    if (!isBlank(providerRow[c])) {
      const pk = providerKey(providerRow[c]!)
      if (pk) carriedProvider = pk
    }

    // Only real policy blocks have "Policy Year" as the block sub-header; this drops the trailing
    // Total Premiums / Total Cash Values columns (sub-header USD/HKD).
    if ((subHeaderRow[c] ?? '').trim().toLowerCase() !== 'policy year') continue

    const numberCell = (numberRow[c] ?? '').trim()
    const name = (nameRow[c] ?? '').trim()
    if (numberCell === '') {
      if (name !== '') warnings.push(`Skipped "${name}" — no policy number.`)
      continue
    }
    if (!carriedProvider) {
      errors.push(`Block at column ${c + 1} ("${name}") has no provider — skipped.`)
      continue
    }

    const { number, startDate } = splitNumberDate(numberCell)
    const points: SchedulePoint[] = []
    for (const row of dataRows) {
      const age = num(row[0])
      if (!Number.isFinite(age) || isBlank(row[0])) continue
      if (isBlank(row[c + 1]) || isBlank(row[c + 2])) continue // premium/cash — real points only
      const policyYear = num(row[c])
      const premium = num(row[c + 1])
      const cash = num(row[c + 2])
      if (!Number.isFinite(premium) || !Number.isFinite(cash)) continue
      points.push({
        age,
        policy_year: Number.isFinite(policyYear) ? policyYear : 0,
        total_premium_paid: premium,
        cash_value: cash,
      })
    }
    if (points.length === 0) {
      warnings.push(`Skipped "${name}" (${number}) — no values.`)
      continue
    }

    policies.push({
      provider: carriedProvider,
      policy_number: number,
      policy_name: name,
      start_date: startDate,
      currency:
        currencyByProvider[carriedProvider] ?? PROVIDER_DEFAULT_CURRENCY[carriedProvider],
      first_year: Math.min(...points.map((p) => p.age)),
      points,
    })
  }

  if (policies.length === 0 && errors.length === 0) {
    errors.push('No importable policy blocks found.')
  }
  return { policies, errors, warnings }
}

export interface ParsedSinglePolicy {
  provider: InsuranceProvider | null
  policy_number: string
  policy_name: string | null
  start_date: string | null
  first_year: number
  points: SchedulePoint[]
}

export interface InsuranceSingleResult {
  policy: ParsedSinglePolicy | null
  errors: string[]
}

/** Parse the narrow single-policy CSV (key/value header + data table). */
export function parseInsuranceSingleCsv(rows: string[][]): InsuranceSingleResult {
  const errors: string[] = []
  if (rows.length === 0) return { policy: null, errors: ['The file is empty.'] }

  // Find the data table header row: first cell "Age" + a "Policy Year" column.
  const tableHeaderIdx = rows.findIndex(
    (r) =>
      (r[0] ?? '').trim().toLowerCase() === 'age' &&
      r.some((c) => c.trim().toLowerCase() === 'policy year'),
  )
  if (tableHeaderIdx === -1) {
    return {
      policy: null,
      errors: ['Could not find the "Age, Policy Year, …" table header.'],
    }
  }

  const header: Record<string, string> = {}
  for (let i = 0; i < tableHeaderIdx; i++) {
    const key = (rows[i]![0] ?? '').trim().toLowerCase()
    const val = (rows[i]![1] ?? '').trim()
    if (key !== '') header[key] = val
  }

  const policyNumber = header['policy number'] ?? ''
  if (policyNumber === '') errors.push('Missing "Policy Number" in the header.')
  const provider = providerKey(header['provider'] ?? '')
  if (header['provider'] && !provider)
    errors.push(`Unknown provider "${header['provider']}".`)

  const points: SchedulePoint[] = []
  for (let r = tableHeaderIdx + 1; r < rows.length; r++) {
    const row = rows[r]!
    if (row.every((c) => c.trim() === '')) continue
    const age = num(row[0])
    if (!Number.isFinite(age) || isBlank(row[0])) continue
    if (isBlank(row[2]) || isBlank(row[3])) continue // premium/cash — real points only
    points.push({
      age,
      policy_year: num(row[1]),
      total_premium_paid: num(row[2]),
      cash_value: num(row[3]),
    })
  }
  if (points.length === 0) errors.push('No data rows with a Premium and Cash Value.')

  if (errors.length > 0) return { policy: null, errors }

  return {
    policy: {
      provider,
      policy_number: policyNumber,
      policy_name: header['policy name'] ? header['policy name']! : null,
      start_date: header['start date'] ? parseLooseDate(header['start date']!) : null,
      first_year: Math.min(...points.map((p) => p.age)),
      points,
    },
    errors,
  }
}
