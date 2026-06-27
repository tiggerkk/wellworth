/**
 * Net Worth domain constants + pure calc helpers. All values are stored in HKD
 * (`value_base`); native currency values convert via a per-entry `fx_rate_to_base`.
 */

export const ASSET_TYPES = [
  'cash',
  'time_deposit',
  'stock',
  'mutual_fund',
  'retirement',
  'insurance',
  'property',
] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  cash: 'Cash',
  time_deposit: 'Time Deposit',
  stock: 'Stock',
  mutual_fund: 'Mutual Fund',
  retirement: 'Retirement',
  insurance: 'Insurance',
  property: 'Property',
}

export const CURRENCIES = ['HKD', 'CNY', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]
export const BASE_CURRENCY: Currency = 'HKD'

/** Type-specific, informational detail fields (stored as-is in `details` JSONB). */
export interface DetailField {
  key: string
  label: string
}
export const DETAIL_FIELDS: Record<AssetType, DetailField[]> = {
  cash: [],
  time_deposit: [{ key: 'maturity_date', label: 'Maturity Date' }],
  stock: [
    { key: 'ticker', label: 'Ticker' },
    { key: 'shares', label: 'Shares' },
  ],
  mutual_fund: [
    { key: 'units', label: 'Units' },
    { key: 'cost', label: 'Cost' },
  ],
  retirement: [],
  insurance: [
    { key: 'premium', label: 'Premium' },
    { key: 'policy_year', label: 'Policy Year' },
  ],
  property: [],
}

/** value in base currency (HKD) = native value × native→HKD rate (1 for HKD). */
export function valueBase(valueNative: number, fxRate: number): number {
  return valueNative * fxRate
}

/** Minimal shape for totals/grouping — satisfied by DB rows and screen drafts alike. */
interface Valued {
  value_base: number
}
interface Typed {
  asset_type: string
}

export function totalBase(entries: Valued[]): number {
  return entries.reduce((sum, e) => sum + (e.value_base ?? 0), 0)
}

/** Partition entries into the 7 asset types, in their fixed order (groups may be empty). */
export function groupByType<T extends Typed>(
  entries: T[],
): { type: AssetType; entries: T[] }[] {
  return ASSET_TYPES.map((type) => ({
    type,
    entries: entries.filter((e) => e.asset_type === type),
  }))
}

/** Format an HKD amount for display, e.g. `HK$1,234,568`. */
export function formatHkd(n: number): string {
  return `HK$${Math.round(n).toLocaleString('en-US')}`
}

/** Compact HKD for chart axes/ticks, e.g. `HK$1.2M` / `HK$450K`. */
export function formatHkdCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `HK$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `HK$${Math.round(n / 1_000)}K`
  return `HK$${Math.round(n)}`
}

/** Sum `value_base` per asset type (all 7 keys present, 0 default). */
export function typeTotals(
  entries: { value_base: number; asset_type: string }[],
): Record<AssetType, number> {
  const out = Object.fromEntries(ASSET_TYPES.map((t) => [t, 0])) as Record<
    AssetType,
    number
  >
  for (const e of entries) {
    if (e.asset_type in out) out[e.asset_type as AssetType] += e.value_base ?? 0
  }
  return out
}

export interface TypeBreakdownRow {
  type: AssetType
  total: number
  pct: number
}

/** Per-type HKD total + share of the grand total from a totals record (fixed order; pct 0 empty). */
export function typeBreakdownFromTotals(
  totals: Record<AssetType, number>,
): TypeBreakdownRow[] {
  const grand = ASSET_TYPES.reduce((s, t) => s + totals[t], 0)
  return ASSET_TYPES.map((type) => ({
    type,
    total: totals[type],
    pct: grand > 0 ? totals[type] / grand : 0,
  }))
}

/** Per-type HKD total + share of the grand total (fixed order; pct 0 when empty). */
export function typeBreakdown(
  entries: { value_base: number; asset_type: string }[],
): TypeBreakdownRow[] {
  return typeBreakdownFromTotals(typeTotals(entries))
}

/** One per-asset-type totals record per month, oldest first, folded from the pre-aggregated
 *  per-(month, type) rows of `networth_monthly_type_total` (all 7 type keys present, 0 default). */
export interface MonthlyTotals {
  month: string
  totals: Record<AssetType, number>
}

export function foldMonthlyTotals(
  rows: { month: string; asset_type: string; total_base: number }[],
): MonthlyTotals[] {
  const byMonth = new Map<string, Record<AssetType, number>>()
  for (const r of rows) {
    let rec = byMonth.get(r.month)
    if (!rec) {
      rec = Object.fromEntries(ASSET_TYPES.map((t) => [t, 0])) as Record<
        AssetType,
        number
      >
      byMonth.set(r.month, rec)
    }
    if (r.asset_type in rec) rec[r.asset_type as AssetType] += r.total_base ?? 0
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([month, totals]) => ({ month, totals }))
}

/** Sum a totals record across all asset types (the month's net worth). */
export function sumTotals(totals: Record<AssetType, number>): number {
  return ASSET_TYPES.reduce((s, t) => s + totals[t], 0)
}

/** Chart/legend/summary color per asset type — CSS vars from the @theme palette (index.css). */
export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  cash: 'var(--color-positive)',
  time_deposit: 'var(--color-cat-activity)',
  stock: 'var(--color-accent)',
  mutual_fund: 'var(--color-cat-supplement)',
  retirement: 'var(--color-cat-snack)',
  insurance: 'var(--color-cat-meal)',
  property: 'var(--color-text-muted)',
}
