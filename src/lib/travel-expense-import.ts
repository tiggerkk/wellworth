/**
 * Expense CSV importer (M6) — a **wide** sheet (one row per day, a column per category) parsed into the
 * long `trip_expense` rows. Pure + testable; the screen handles trip resolution + insertion.
 *
 * Columns (the app-wide CSV convention — RFC-4180 via `parseCsv`, UTF-8, dates `YYYY-MM-DD`, thousands
 * commas/currency symbols stripped):
 *   Trip, Date, Restaurant, Take-out, Groceries, Shopping, Activity, Hotel, Local Transit, Flight/Train,
 *   Cost, Re-imbursed
 * - `Trip` attributes the row to a trip (matched by name; the screen creates it if missing).
 * - Each **category column** that has a value contributes one expense in that category; a row with >1
 *   populated category **splits** into several expenses. `Cost` is the row total, cross-checked against
 *   the sum of the category cells (a mismatch is a warning, not a hard error).
 * - `Re-imbursed` is the row's reimbursed amount, **allocated across the split expenses pro-rata** by cost.
 * - **Unknown headers aren't dropped** — they're surfaced so the owner can map them to a category (or skip)
 *   on the review screen before import.
 */
import { parseCsv } from './csv'
import {
  categoryLabel,
  matchKeyOrLabel,
  type TravelCategoryConfig,
} from './travel-config'

const RESERVED: Record<'trip' | 'date' | 'cost' | 'reimbursed', string[]> = {
  trip: ['trip'],
  date: ['date'],
  cost: ['cost', 'total'],
  reimbursed: ['re-imbursed', 'reimbursed', 're-imbursement', 'reimbursement'],
}

const norm = (h: string) => h.trim().toLowerCase()

export interface CategoryCol {
  index: number
  header: string
  key: string
}
export interface UnknownCol {
  index: number
  header: string
}

export interface ParsedExpenseCsv {
  headers: string[]
  dataRows: string[][]
  tripCol: number | null
  dateCol: number | null
  costCol: number | null
  reimbursedCol: number | null
  categoryCols: CategoryCol[]
  unknownCols: UnknownCol[]
  errors: string[]
}

/** Classify the header row into reserved / category / unknown columns. */
export function parseExpenseCsv(
  text: string,
  categories: TravelCategoryConfig[],
): ParsedExpenseCsv {
  const rows = parseCsv(text)
  const headers = (rows[0] ?? []).map((h) => h.trim())
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''))
  const errors: string[] = []

  let tripCol: number | null = null
  let dateCol: number | null = null
  let costCol: number | null = null
  let reimbursedCol: number | null = null
  const categoryCols: CategoryCol[] = []
  const unknownCols: UnknownCol[] = []

  headers.forEach((header, index) => {
    if (!header) return
    const n = norm(header)
    if (tripCol == null && RESERVED.trip.includes(n)) tripCol = index
    else if (dateCol == null && RESERVED.date.includes(n)) dateCol = index
    else if (costCol == null && RESERVED.cost.includes(n)) costCol = index
    else if (reimbursedCol == null && RESERVED.reimbursed.includes(n))
      reimbursedCol = index
    else {
      const key = matchKeyOrLabel(categories, header)
      if (key) categoryCols.push({ index, header, key })
      else unknownCols.push({ index, header })
    }
  })

  if (tripCol == null) errors.push('Missing a "Trip" column.')
  if (categoryCols.length === 0 && costCol == null)
    errors.push('No category columns or a "Cost" column were found.')

  return {
    headers,
    dataRows,
    tripCol,
    dateCol,
    costCol,
    reimbursedCol,
    categoryCols,
    unknownCols,
    errors,
  }
}

/** Strip currency symbols / thousands separators / quotes → a finite number, or null. */
export function parseAmount(cell: string | undefined): number | null {
  if (cell == null) return null
  const cleaned = cell.replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Normalize a date cell to `YYYY-MM-DD`, or null. Accepts `-` or `/` separators. */
export function parseDate(cell: string | undefined): string | null {
  if (!cell) return null
  const m = cell.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (!m) return null
  const [, y, mo, d] = m
  return `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`
}

export interface ImportedExpense {
  tripName: string
  expense_date: string | null
  description: string
  category: string
  cost: number
  reimbursed_formula: string | null
  reimbursed_amount: number | null
}

export interface TripGroup {
  tripName: string
  count: number
  total: number
}

export interface BuildExpensesResult {
  expenses: ImportedExpense[]
  byTrip: TripGroup[]
  warnings: string[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Build the long expense list from a parsed sheet. `mapping` maps each unknown header to a category key
 * (or '' to skip it). A row with no category cell falls back to the first category when it has a Cost.
 */
export function buildExpenses(
  parsed: ParsedExpenseCsv,
  categories: TravelCategoryConfig[],
  mapping: Record<string, string>,
): BuildExpensesResult {
  const expenses: ImportedExpense[] = []
  const warnings: string[] = []
  const fallback = categories[0]?.key ?? ''

  const mappedUnknown = parsed.unknownCols
    .map((u) => ({ index: u.index, key: mapping[u.header] ?? '' }))
    .filter((u) => u.key !== '')

  parsed.dataRows.forEach((row, i) => {
    const rowNo = i + 2 // 1-based, +1 for the header row
    const tripName = parsed.tripCol != null ? (row[parsed.tripCol] ?? '').trim() : ''
    if (!tripName) {
      warnings.push(`Row ${rowNo}: no Trip — skipped.`)
      return
    }
    const date = parsed.dateCol != null ? parseDate(row[parsed.dateCol]) : null
    const costTotal = parsed.costCol != null ? parseAmount(row[parsed.costCol]) : null
    const reimbursedTotal =
      parsed.reimbursedCol != null ? parseAmount(row[parsed.reimbursedCol]) : null

    // Sum amounts by category key (a row can repeat a key across mapped columns).
    const byKey = new Map<string, number>()
    for (const col of parsed.categoryCols) {
      const amt = parseAmount(row[col.index])
      if (amt != null && amt !== 0) byKey.set(col.key, (byKey.get(col.key) ?? 0) + amt)
    }
    for (const col of mappedUnknown) {
      const amt = parseAmount(row[col.index])
      if (amt != null && amt !== 0) byKey.set(col.key, (byKey.get(col.key) ?? 0) + amt)
    }

    let parts = [...byKey.entries()].map(([key, amt]) => ({ key, amt }))
    if (parts.length === 0) {
      if (costTotal != null && costTotal !== 0 && fallback) {
        parts = [{ key: fallback, amt: costTotal }]
        warnings.push(
          `Row ${rowNo}: no category column filled — assigned to “${categoryLabel(categories, fallback)}”.`,
        )
      } else {
        warnings.push(`Row ${rowNo}: no amount — skipped.`)
        return
      }
    }

    const total = parts.reduce((s, p) => s + p.amt, 0)
    if (costTotal != null && Math.abs(total - costTotal) > 0.01) {
      warnings.push(`Row ${rowNo}: category sum ${total} ≠ Cost ${costTotal}.`)
    }

    // Allocate the row's reimbursed amount across its parts pro-rata; last part takes the remainder.
    let allocated = 0
    parts.forEach((p, idx) => {
      let reimbursed: number | null = null
      if (reimbursedTotal != null && total > 0) {
        reimbursed =
          idx === parts.length - 1
            ? round2(reimbursedTotal - allocated)
            : round2((reimbursedTotal * p.amt) / total)
        allocated += reimbursed
      }
      expenses.push({
        tripName,
        expense_date: date,
        description: categoryLabel(categories, p.key),
        category: p.key,
        cost: p.amt,
        reimbursed_formula: reimbursed != null ? String(reimbursed) : null,
        reimbursed_amount: reimbursed,
      })
    })
  })

  const groups = new Map<string, TripGroup>()
  for (const e of expenses) {
    let g = groups.get(e.tripName)
    if (!g) {
      g = { tripName: e.tripName, count: 0, total: 0 }
      groups.set(e.tripName, g)
    }
    g.count += 1
    g.total += e.cost
  }

  return { expenses, byTrip: [...groups.values()], warnings }
}
