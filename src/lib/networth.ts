/**
 * Net Worth domain constants + pure calc helpers. All values are stored in HKD
 * (`value_base`); native currency values convert via a per-entry `fx_rate_to_base`.
 */

export const ASSET_TYPES = [
  'cash',
  'time_deposit',
  'stock',
  'fund',
  'retirement',
  'insurance',
  'property',
] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  cash: 'Cash',
  time_deposit: 'Time Deposit',
  stock: 'Stock',
  fund: 'Fund',
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
  // Fund rows are populated by the JPM CSV importer (not the generic detail editor); their
  // detail fields are surfaced read-only in the Fund detail modal (FUND_DETAIL_FIELDS below).
  fund: [],
  retirement: [],
  // Insurance rows are auto-generated from the policy catalogue (no manual detail editing);
  // their resolved figures are shown read-only in the Policy detail modal.
  insurance: [],
  property: [],
}

/** Read-only fields shown in the Fund detail modal, sourced from the importer's `details`. */
export const FUND_DETAIL_FIELDS: DetailField[] = [
  { key: 'units', label: 'Units (Total Holdings)' },
  { key: 'avg_cost', label: 'Avg Unit Cost' },
  { key: 'nav', label: 'NAV per Unit' },
  { key: 'nav_as_of', label: 'Priced as of' },
  { key: 'total_cost', label: 'Total Cost' },
  { key: 'pnl', label: 'Profit / Loss' },
  { key: 'asset_class', label: 'Asset Class' },
]

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

/** Tailwind text-color class for a gain/loss figure: teal when positive, red when negative,
 *  muted at zero. Shared by every Net Worth percentage (returns, surrender gain) so gains read
 *  green and losses red consistently. */
export function gainLossClass(n: number): string {
  return n > 0 ? 'text-positive' : n < 0 ? 'text-danger' : 'text-text-secondary'
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

/** The owner's asset-type order (NULL = canonical), with any newer types appended. */
export function orderedAssetTypes(order: string[] | null | undefined): AssetType[] {
  if (!order) return [...ASSET_TYPES]
  const known = order.filter((k): k is AssetType =>
    (ASSET_TYPES as readonly string[]).includes(k),
  )
  const missing = ASSET_TYPES.filter((k) => !known.includes(k))
  return [...known, ...missing]
}

/** Asset types treated as liquid by default — cash, time deposit, stock, fund (the owner can
 *  re-classify in Net Worth Settings → Liquid Assets, stored on `networth_liquid_asset_types`). */
export const DEFAULT_LIQUID_ASSET_TYPES: AssetType[] = [
  'cash',
  'time_deposit',
  'stock',
  'fund',
]

/** The owner's liquid asset-type set — NULL = the defaults above; otherwise the stored keys
 *  filtered to known types, returned in canonical order. Drives the "Liquid Only" view toggle. */
export function liquidAssetTypes(value: string[] | null | undefined): AssetType[] {
  if (value == null) return [...DEFAULT_LIQUID_ASSET_TYPES]
  return ASSET_TYPES.filter((t) => value.includes(t))
}

/** A copy of a totals record with every type outside `types` zeroed (keeps all 7 keys). Used by
 *  the Dashboard's "Liquid Only" filter so `sumTotals`/`typeBreakdownFromTotals` recompute against
 *  the liquid subset (non-liquid rows fall to 0 and drop out of the breakdown). */
export function restrictTotals(
  totals: Record<AssetType, number>,
  types: AssetType[],
): Record<AssetType, number> {
  const allow = new Set(types)
  return Object.fromEntries(
    ASSET_TYPES.map((t) => [t, allow.has(t) ? totals[t] : 0]),
  ) as Record<AssetType, number>
}

/** Visible asset types in display order — NULL visible = all; a type absent from `order` (newer
 *  than the saved customization) defaults visible (mirrors the Home-hub module rule). */
export function visibleAssetTypes(
  order: string[] | null | undefined,
  visible: string[] | null | undefined,
): AssetType[] {
  const ordered = orderedAssetTypes(order)
  if (!visible) return ordered
  const seen = new Set(order ?? [])
  return ordered.filter((k) => visible.includes(k) || !seen.has(k))
}

/**
 * Chart/legend/summary + section-accent color per asset type — CSS vars from the @theme palette
 * (index.css). Shared by the Dashboard "By asset type" dots, the Monthly-Entry section stripes/tints,
 * and the trend chart, so every surface reads the same hue per type. Hues are picked so that
 * *consecutive* types in `ASSET_TYPES` jump across the colour wheel (green → blue → gold → purple →
 * orange → rose → grey) — no two adjacent sections share a warm/cool band, so they read clearly apart.
 */
export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  cash: 'var(--color-positive)', // teal-green
  time_deposit: 'var(--color-cat-activity)', // blue
  stock: 'var(--color-dynasty)', // gold (was a 2nd blue, too close to time_deposit)
  fund: 'var(--color-cat-supplement)', // purple
  retirement: 'var(--color-cat-snack)', // orange
  insurance: 'var(--color-favorite)', // rose (was red, too close to retirement orange)
  property: 'var(--color-text-muted)', // grey
}

// =====================================================================================
// Insurance — provider catalogue + age-based schedule resolution (pure helpers).
// A policy has one or more schedule VERSIONS (an Original baseline + later anniversary
// updates); each version is a set of per-age points carrying only real (printed) values.
// For a given age, the resolved figure comes from the newest-effective version whose
// first_year ≤ age, using the value at that age or the nearest earlier real point ("as of
// yr N"). Variance is measured against the Original (baseline) version. See docs/05_networth.md.
// =====================================================================================

// Seed defaults only — the live provider list is owner-configurable (the Quotes pattern), stored on
// `profile.insurance_providers` and resolved by src/lib/insurance-config.ts. These three feed the NULL
// fallback (`defaultProviders()`); `InsuranceProvider` describes the seeds' keys, but stored values are
// plain string keys (insurance_policy.provider has no CHECK).
export const INSURANCE_PROVIDERS = ['chubb', 'boc', 'manulife'] as const
export type InsuranceProvider = (typeof INSURANCE_PROVIDERS)[number]
export const INSURANCE_PROVIDER_LABELS: Record<InsuranceProvider, string> = {
  chubb: 'CHUBB',
  boc: 'BOC',
  manulife: 'Manulife',
}
/** Seed default currency per provider (the bulk-import per-provider currency starts here). */
export const PROVIDER_DEFAULT_CURRENCY: Record<InsuranceProvider, Currency> = {
  chubb: 'USD',
  boc: 'USD',
  manulife: 'HKD',
}

/** The user's birth year — insurance ages are computed as `entry_year − BIRTH_YEAR`. */
export const DEFAULT_BIRTH_YEAR = 1974

export interface SchedulePoint {
  age: number
  policy_year: number
  total_premium_paid: number
  cash_value: number
}

export interface ScheduleVersion {
  id: string
  kind: 'original' | 'update'
  first_year: number
  effective_date: string | null
  points: SchedulePoint[]
}

/** Resolved figure for a policy at a given age (native currency; convert to HKD at the UI). */
export interface ResolvedPolicy {
  policyYear: number
  premium: number
  cashValue: number
  /** Policy year of the source point — used for the "as of yr N" tag when carried. */
  asOfYear: number
  /** True when no real point existed at `age` and an earlier point was carried forward. */
  isCarried: boolean
  sourceAge: number
}

/** Insurance age for a calendar year (same age for every month in the year). */
export function ageForYear(year: number, birthYear: number = DEFAULT_BIRTH_YEAR): number {
  return year - birthYear
}

/** The point at `age`, or the nearest earlier real point in this version (null if none ≤ age). */
function pointAtOrBefore(version: ScheduleVersion, age: number): SchedulePoint | null {
  let best: SchedulePoint | null = null
  for (const p of version.points) {
    if (p.age <= age && (best === null || p.age > best.age)) best = p
  }
  return best
}

/** The newest-effective version whose first_year ≤ age (effective_date desc; null sorts last). */
function pickVersion(schedules: ScheduleVersion[], age: number): ScheduleVersion | null {
  const applicable = schedules.filter((s) => s.first_year <= age && s.points.length > 0)
  if (applicable.length === 0) return null
  return applicable.reduce((best, s) => {
    const a = s.effective_date ?? ''
    const b = best.effective_date ?? ''
    return a > b ? s : best
  })
}

/** Resolve a policy's premium / cash value / policy year at an age, or null if not yet started. */
export function resolvePolicyAtAge(
  schedules: ScheduleVersion[],
  age: number,
): ResolvedPolicy | null {
  const version = pickVersion(schedules, age)
  if (!version) return null
  const point = pointAtOrBefore(version, age)
  if (!point) return null
  return {
    policyYear: point.policy_year,
    premium: point.total_premium_paid,
    cashValue: point.cash_value,
    asOfYear: point.policy_year,
    isCarried: point.age !== age,
    sourceAge: point.age,
  }
}

/** The Original (baseline) version — `kind: 'original'`, else the earliest-effective version. */
export function originalSchedule(schedules: ScheduleVersion[]): ScheduleVersion | null {
  const orig = schedules.find((s) => s.kind === 'original')
  if (orig) return orig
  if (schedules.length === 0) return null
  return schedules.reduce((earliest, s) =>
    (s.effective_date ?? '') < (earliest.effective_date ?? '') ? s : earliest,
  )
}

/** Original (baseline) cash value at an age (nearest earlier real point), or null. */
export function originalCashValueAtAge(
  schedules: ScheduleVersion[],
  age: number,
): number | null {
  const orig = originalSchedule(schedules)
  if (!orig || orig.first_year > age) return null
  return pointAtOrBefore(orig, age)?.cash_value ?? null
}

/** Resolved − Original cash value at an age (actual vs. original proposal), or null. */
export function varianceAtAge(schedules: ScheduleVersion[], age: number): number | null {
  const resolved = resolvePolicyAtAge(schedules, age)
  const original = originalCashValueAtAge(schedules, age)
  if (resolved === null || original === null) return null
  return resolved.cashValue - original
}

export interface ResolvedSeriesPoint extends ResolvedPolicy {
  age: number
}

/** The resolved trajectory across every age that appears as a real point in any version. */
export function buildResolvedSeries(schedules: ScheduleVersion[]): ResolvedSeriesPoint[] {
  const ages = new Set<number>()
  for (const s of schedules) for (const p of s.points) ages.add(p.age)
  return [...ages]
    .sort((a, b) => a - b)
    .map((age) => {
      const r = resolvePolicyAtAge(schedules, age)
      return r ? { age, ...r } : null
    })
    .filter((r): r is ResolvedSeriesPoint => r !== null)
}

export interface BreakEven {
  age: number
  /** True when the first tracked year already qualifies (schedule starts mid-life). */
  atOrBeforeFirst: boolean
}

/** First age where cash value ≥ total premium paid over the resolved series (null if never). */
export function breakEven(schedules: ScheduleVersion[]): BreakEven | null {
  const series = buildResolvedSeries(schedules)
  const idx = series.findIndex((p) => p.cashValue >= p.premium)
  if (idx === -1) return null
  return { age: series[idx]!.age, atOrBeforeFirst: idx === 0 }
}

/** True when the policy has ALREADY reached break-even by `age` (its break-even age ≤ age). The
 *  bare `breakEven` returns the first qualifying age across the WHOLE resolved series (incl. future
 *  ages), so it answers "will it ever?" — this answers "has it yet?" for the current age. */
export function hasBrokenEven(schedules: ScheduleVersion[], age: number): boolean {
  const be = breakEven(schedules)
  return be != null && be.age <= age
}

/** Surrender gain %/yr = (cash − premium) / premium / policyYear × 100 (0 when undefined). */
export function surrenderGainPctPerYear(
  cashValue: number,
  premium: number,
  policyYear: number,
): number {
  if (premium <= 0 || policyYear <= 0) return 0
  return ((cashValue - premium) / premium / policyYear) * 100
}
