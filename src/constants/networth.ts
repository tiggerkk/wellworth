/**
 * Net Worth module enums + display labels (the source of truth for the CHECK columns, which the
 * generated DB types surface as plain `string`). Pure constants only — runtime helpers live in `src/lib/networth.ts`.
 */
import {
  PALETTE_BLUE,
  PALETTE_BROWN,
  PALETTE_CYAN,
  PALETTE_EMERALD,
  PALETTE_GOLD,
  PALETTE_GREY,
  PALETTE_MAGENTA,
  PALETTE_PURPLE,
  PALETTE_RED,
  PALETTE_OFF_WHITE,
} from './palette'

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

/**
 * Chart/legend/summary + section-accent color per asset type — shared palette constants
 * (src/constants/palette.ts). Shared by the Dashboard "By asset type" dots, the Monthly-Entry
 * section stripes/tints, and the trend chart, so every surface reads the same hue per type. Hues
 * are picked so that *consecutive* types in `ASSET_TYPES` jump across the colour wheel — no two
 * adjacent sections share a warm/cool band, so they read clearly apart.
 */
export const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  cash: PALETTE_GOLD,
  time_deposit: PALETTE_BLUE,
  stock: PALETTE_EMERALD,
  fund: PALETTE_MAGENTA,
  retirement: PALETTE_CYAN,
  insurance: PALETTE_RED,
  property: PALETTE_GREY,
}

export const NETWORTH_CURRENCIES = ['HKD', 'CNY', 'USD'] as const
export type NetWorthCurrency = (typeof NETWORTH_CURRENCIES)[number]
export const BASE_CURRENCY: NetWorthCurrency = 'HKD'

/** Type-specific, informational detail fields (stored as-is in `details` JSONB). */
export interface DetailField {
  key: string
  label: string
}
export const ASSET_DETAIL_FIELDS: Record<AssetType, DetailField[]> = {
  cash: [],
  time_deposit: [{ key: 'maturity_date', label: 'Maturity Date' }],
  stock: [
    { key: 'ticker', label: 'Ticker' },
    { key: 'shares', label: 'Shares' },
  ],
  // Fund rows are populated by the JPM CSV importer (not the generic detail editor); their
  // detail fields are surfaced read-only in the Fund detail modal.
  fund: [],
  retirement: [],
  // Insurance rows are auto-generated from the policy catalogue (no manual detail editing);
  // their resolved figures are shown read-only in the Policy detail modal.
  insurance: [],
  property: [],
}

/** Asset types treated as liquid by default — cash, time deposit, stock, fund (the owner can
 *  re-classify in Net Worth Settings → Liquid Assets, stored on `networth_liquid_asset_types`). */
export const DEFAULT_LIQUID_ASSET_TYPES: AssetType[] = [
  'cash',
  'time_deposit',
  'stock',
  'fund',
]

// =====================================================================================
// Insurance — provider catalogue + age-based schedule resolution (pure helpers).
// A policy has one or more schedule VERSIONS (an Original baseline + later anniversary
// updates); each version is a set of per-age points carrying only real (printed) values.
// For a given age, the resolved figure comes from the newest-effective version whose
// first_year ≤ age, using the value at that age or the nearest earlier real point ("as of
// yr N"). Variance is measured against the Original (baseline) version. See docs/05_networth.md.
// =====================================================================================

// Seed defaults only — the live provider list is owner-configurable, stored on
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
export const PROVIDER_DEFAULT_CURRENCY: Record<InsuranceProvider, NetWorthCurrency> = {
  chubb: 'USD',
  boc: 'USD',
  manulife: 'HKD',
}

/**
 * The swatch palette for **provider colours** — the choices offered by the per-row colour picker in
 * Net Worth Settings → Manage Providers, and the default-assignment cycle for seed / new providers
 * (`src/lib/insurance-config.ts`). Values are design tokens (CSS vars) so they track the theme. The
 * provider's chosen colour is stored per entry on `profile.insurance_providers` and drives the leading
 * dot on each row in Manage Providers, and the left-strip accent on each row in Insurance Policies.
 */
export const INSURANCE_PROVIDER_COLORS = [
  { name: 'Gold', value: PALETTE_GOLD },
  { name: 'Magenta', value: PALETTE_MAGENTA },
  { name: 'Purple', value: PALETTE_PURPLE },
  { name: 'Brown', value: PALETTE_BROWN },
  { name: 'Cyan', value: PALETTE_CYAN },
  { name: 'Red', value: PALETTE_RED },
  { name: 'Grey', value: PALETTE_GREY },
  { name: 'Blue', value: PALETTE_BLUE },
  { name: 'Emerald', value: PALETTE_EMERALD },
  { name: 'Off-White', value: PALETTE_OFF_WHITE },
] as const

/** Neutral fallback for an orphan/unconfigured provider colour (e.g. a deleted provider still on a policy). */
export const INSURANCE_PROVIDER_COLOR_FALLBACK = 'var(--color-text-secondary)'

/** The user's birth year — insurance ages are computed as `entry_year − BIRTH_YEAR`. */
export const DEFAULT_BIRTH_YEAR = 1974

/** Net Worth dashboard trend windows. `months: null` = All. */
export interface NetWorthRange {
  key: string
  label: string
  months: number | null
}

/**
 * Pure UI constants — not persisted; edit freely (add/remove/relabel windows, change the month counts)
 * and the change takes effect on reload, with no DB or other code change. The only coupling is the
 * default below, which the screen reads instead of hardcoding a key.
 */
export const NETWORTH_RANGES: NetWorthRange[] = [
  { key: '6m', label: '6M', months: 6 },
  { key: '12m', label: '12M', months: 12 },
  { key: '2y', label: '2Y', months: 24 },
  { key: '3y', label: '3Y', months: 36 },
  { key: '5y', label: '5Y', months: 60 },
  { key: 'all', label: 'All', months: null },
]

/** Default selected window. Must be one of NETWORTH_RANGES' keys (keep the default here, not in the screen). */
export const NETWORTH_RANGE_DEFAULT = 'all'
