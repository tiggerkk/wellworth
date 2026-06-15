/**
 * Net Worth domain constants + pure calc helpers (Phase 2). All values are stored in HKD
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
  time_deposit: [{ key: 'maturity_date', label: 'Maturity date' }],
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
    { key: 'policy_year', label: 'Policy year' },
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
