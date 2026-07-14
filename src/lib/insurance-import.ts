/**
 * Pure parsing for the two insurance CSV imports (see `templates/insurance-import-guide.md`):
 *
 *  1. BULK SEED — the wide spreadsheet (`templates/Insurance.xlsx` saved as CSV). One 4-column
 *     block per policy (`Policy Year, Total Premium Paid, Cash Value, Surrender Gain %/Yr`) with
 *     a shared `Age` in column A. Five header rows: provider (merged → carried forward across
 *     blank cells), policy name, `number: start_date`, **notes** (per-policy, in the block's first
 *     column), and the repeating sub-header. Blocks with no policy number are skipped; trailing
 *     total columns (sub-header USD/HKD) are dropped.
 *
 *  2. SINGLE POLICY — a narrow one-policy file: a tiny key/value header (Provider, Policy Number,
 *     optional Policy Name, Start Date, Notes), then the `Age, Policy Year, Total Premium Paid,
 *     Cash Value, Surrender Gain %/Yr` table. Surrender Gain is ignored (the app recomputes it);
 *     currency + effective date are NOT in the file (set on the New/Edit Insurance screen).
 *
 * Both imports auto-detect **maturity** (`detectMaturity`): a schedule that ends before the owner's
 * current age is a matured policy (proceeds = last cash value; date from start + last policy year).
 * No I/O. Only real (printed) premium+cash points are emitted — carry-forward is a display rule.
 */
import { type NetWorthCurrency } from '../constants/networth'
import { type SchedulePoint } from './networth'
import {
  defaultCurrencyFor,
  matchKeyOrLabel,
  type InsuranceProviderConfig,
} from './insurance-config'

/** The four termination columns a parsed policy may carry (auto-detected maturity). */
export interface TerminationFields {
  termination_kind: 'surrendered' | 'matured' | null
  termination_date: string | null
  termination_effective_date: string | null
  termination_proceeds: number | null
}

const NO_TERMINATION: TerminationFields = {
  termination_kind: null,
  termination_date: null,
  termination_effective_date: null,
  termination_proceeds: null,
}

export interface ParsedPolicy extends TerminationFields {
  provider: string // configured provider key
  policy_number: string
  policy_name: string
  start_date: string | null // ISO yyyy-mm-dd
  currency: NetWorthCurrency
  first_year: number
  points: SchedulePoint[]
  notes: string | null
}

/**
 * Auto-detect maturity from a policy's schedule: if the schedule ENDS before the current age (no
 * point at/after `currentAge`) and we know the start date, the policy has matured. Proceeds = the
 * last (highest-age) point's cash value; date = the start date's month+day with year =
 * `start_year + that point's policy_year` (per the owner's convention). Returns `NO_TERMINATION`
 * when still in force / indeterminable. Pure.
 */
export function detectMaturity(
  points: SchedulePoint[],
  startDate: string | null,
  currentAge: number,
): TerminationFields {
  if (points.length === 0 || !startDate || !Number.isFinite(currentAge)) {
    return NO_TERMINATION
  }
  const last = points.reduce((a, b) => (b.age > a.age ? b : a))
  if (last.age >= currentAge) return NO_TERMINATION // a point at/after current age ⇒ in force
  const maturityYear = Number(startDate.slice(0, 4)) + last.policy_year
  const date = `${maturityYear}${startDate.slice(4)}` // reuse the start date's -MM-DD
  return {
    termination_kind: 'matured',
    termination_date: date,
    termination_effective_date: date,
    termination_proceeds: last.cash_value,
  }
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
 * Parse the wide bulk-seed CSV. `providers` is the owner's configured provider list (the CSV's
 * provider labels are matched against it); `currencyByProvider` is the per-provider currency confirmed
 * at import (defaults to each provider's `defaultCurrency`). A provider label that matches none of the
 * configured providers makes its block skip with an error — add it in Settings, then re-import.
 */
export function parseInsuranceBulkCsv(
  rows: string[][],
  providers: InsuranceProviderConfig[],
  currencyByProvider: Record<string, NetWorthCurrency> = {},
  currentAge: number = NaN,
): InsuranceBulkResult {
  const errors: string[] = []
  const warnings: string[] = []
  const policies: ParsedPolicy[] = []

  if (rows.length < 6) {
    return {
      policies,
      errors: ['The file does not have the expected header rows.'],
      warnings,
    }
  }

  // Row order: provider · name · number:date · notes · sub-header · data…
  const providerRow = rows[0]!
  const nameRow = rows[1]!
  const numberRow = rows[2]!
  const notesRow = rows[3]!
  const subHeaderRow = rows[4]!
  const dataRows = rows.slice(5)

  const colCount = Math.max(
    providerRow.length,
    nameRow.length,
    numberRow.length,
    notesRow.length,
    subHeaderRow.length,
  )

  // Carry the provider key forward across blank cells (CSV flattens merged cells).
  let carriedProvider: string | null = null

  for (let c = 1; c + 2 < colCount; c += 4) {
    if (!isBlank(providerRow[c])) {
      const pk = matchKeyOrLabel(providers, providerRow[c]!)
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
        currencyByProvider[carriedProvider] ??
        defaultCurrencyFor(providers, carriedProvider),
      first_year: Math.min(...points.map((p) => p.age)),
      points,
      notes: (notesRow[c] ?? '').trim() || null,
      ...detectMaturity(points, startDate, currentAge),
    })
  }

  if (policies.length === 0 && errors.length === 0) {
    errors.push('No importable policy blocks found.')
  }
  return { policies, errors, warnings }
}

export interface ParsedSinglePolicy extends TerminationFields {
  provider: string | null // matched configured provider key, or null if absent/unknown
  policy_number: string
  policy_name: string | null
  start_date: string | null
  first_year: number
  points: SchedulePoint[]
  notes: string | null
}

export interface InsuranceSingleResult {
  policy: ParsedSinglePolicy | null
  errors: string[]
}

interface SinglePolicyHeader {
  provider: string | null
  policyNumber: string
  policyName: string | null
  startDate: string | null
  notes: string | null
}

/**
 * Read the single-policy header in either accepted layout (errors are pushed onto `errors`):
 *  • KEY/VALUE — col A is a label (`Provider`, `Policy Number`, `Policy Name`, `Start Date`,
 *    `Notes`), col B its value (the documented narrow format).
 *  • BLOCK — col A blank, with provider / policy name / `number: date` / notes stacked in col B.
 *    This is what the owner's wide spreadsheet exports for a single policy (one bulk block on its
 *    own), so the importer accepts it without manual reformatting.
 * The layout is detected by whether any header row has a col-A label.
 */
function readSinglePolicyHeader(
  headerRows: string[][],
  providers: InsuranceProviderConfig[],
  errors: string[],
): SinglePolicyHeader {
  const isBlock = headerRows.length > 0 && headerRows.every((r) => isBlank(r[0]))

  if (!isBlock) {
    const header: Record<string, string> = {}
    for (const r of headerRows) {
      const key = (r[0] ?? '').trim().toLowerCase()
      const val = (r[1] ?? '').trim()
      if (key !== '') header[key] = val
    }
    const policyNumber = header['policy number'] ?? ''
    if (policyNumber === '') errors.push('Missing "Policy Number" in the header.')
    const provider = matchKeyOrLabel(providers, header['provider'] ?? '')
    if (header['provider'] && !provider)
      errors.push(`Unknown provider "${header['provider']}".`)
    return {
      provider,
      policyNumber,
      policyName: header['policy name'] || null,
      startDate: header['start date'] ? parseLooseDate(header['start date']!) : null,
      notes: header['notes'] || null,
    }
  }

  // Block layout: the stacked values live in col B. Identify rows by content (robust to the
  // optional notes row being absent), matching the bulk block's order: provider · name ·
  // `number: date` · notes.
  const cells = headerRows.map((r) => (r[1] ?? '').trim())
  // `number: date` row — its colon-tail parses as a date; fall back to the first colon-bearing cell.
  let numIdx = cells.findIndex((c) => {
    const i = c.indexOf(':')
    return i > 0 && parseLooseDate(c.slice(i + 1)) != null
  })
  if (numIdx === -1) numIdx = cells.findIndex((c) => c.includes(':'))
  let policyNumber = ''
  let startDate: string | null = null
  if (numIdx !== -1) {
    const split = splitNumberDate(cells[numIdx]!)
    policyNumber = split.number
    startDate = split.startDate
  }
  if (policyNumber === '') errors.push('Missing policy number in the file header.')

  const provIdx = cells.findIndex(
    (c) => c !== '' && matchKeyOrLabel(providers, c) != null,
  )
  const provider = provIdx !== -1 ? matchKeyOrLabel(providers, cells[provIdx]!) : null

  // Of the remaining non-blank cells, the one before the number row is the policy name; one
  // after it is the notes.
  const rest = cells
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => c !== '' && i !== numIdx && i !== provIdx)
  const nameCell = rest.find(({ i }) => numIdx === -1 || i < numIdx)
  const notesCell = rest.find(({ i }) => numIdx !== -1 && i > numIdx)
  return {
    provider,
    policyNumber,
    policyName: nameCell?.c || null,
    startDate,
    notes: notesCell?.c || null,
  }
}

/**
 * Parse the single-policy CSV (header + data table). Two header layouts are accepted — the
 * documented key/value header and the owner's stacked block export — see `readSinglePolicyHeader`.
 */
export function parseInsuranceSingleCsv(
  rows: string[][],
  providers: InsuranceProviderConfig[],
  currentAge: number = NaN,
): InsuranceSingleResult {
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

  const { provider, policyNumber, policyName, startDate, notes } = readSinglePolicyHeader(
    rows.slice(0, tableHeaderIdx),
    providers,
    errors,
  )

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
      policy_name: policyName,
      start_date: startDate,
      first_year: Math.min(...points.map((p) => p.age)),
      points,
      notes,
      ...detectMaturity(points, startDate, currentAge),
    },
    errors,
  }
}
