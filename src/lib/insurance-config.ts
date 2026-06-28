/**
 * Insurance configurable-provider helpers — pure, unit-tested. The owner can add / rename / delete /
 * reorder the **Provider** list (and each provider's default import currency) in Net Worth Settings →
 * Manage Providers; the list is stored as a JSONB array on `profile.insurance_providers` (display
 * order = array order).
 *
 * `insurance_policy.provider` stores a stable `key` from this list; only the `label` (and the
 * import-time `defaultCurrency`) is editable, so a rename never touches policy rows. Lookups fall back
 * to the raw key (orphan tolerance, like `quotes-config`) so a policy whose provider was deleted still
 * renders + edits.
 *
 * NULL/empty/invalid override ⇒ the canonical seed defaults in `src/lib/networth.ts`. Mirrors the
 * Quotes/Travel pattern: a non-null override is **authoritative and complete** (we do NOT re-append
 * missing canonical defaults) — otherwise a deleted default would resurrect on next load.
 */
import {
  INSURANCE_PROVIDERS,
  INSURANCE_PROVIDER_LABELS,
  PROVIDER_DEFAULT_CURRENCY,
  CURRENCIES,
  BASE_CURRENCY,
  type Currency,
} from './networth'

export type InsuranceProviderConfig = {
  key: string
  label: string
  defaultCurrency: Currency
}

/** The canonical provider defaults (seed + NULL fallback), in their display order. */
export function defaultProviders(): InsuranceProviderConfig[] {
  return INSURANCE_PROVIDERS.map((key) => ({
    key,
    label: INSURANCE_PROVIDER_LABELS[key],
    defaultCurrency: PROVIDER_DEFAULT_CURRENCY[key],
  }))
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const isCurrency = (v: unknown): v is Currency =>
  typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v)

function readEntry(v: unknown): InsuranceProviderConfig | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const key = typeof o.key === 'string' ? o.key.trim() : ''
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  if (!key || !label) return null
  // Tolerate a missing/garbled currency by defaulting to base (HKD).
  const defaultCurrency = isCurrency(o.defaultCurrency)
    ? o.defaultCurrency
    : BASE_CURRENCY
  return { key, label, defaultCurrency }
}

/** Resolve the owner's provider list (override JSONB) → validated configs; NULL/empty ⇒ defaults. */
export function effectiveProviders(override: unknown): InsuranceProviderConfig[] {
  const seen = new Set<string>()
  const out: InsuranceProviderConfig[] = []
  for (const raw of asArray(override)) {
    const base = readEntry(raw)
    if (!base || seen.has(base.key)) continue
    out.push(base)
    seen.add(base.key)
  }
  return out.length > 0 ? out : defaultProviders()
}

// --- Tolerant lookups (raw-key fallback) ---

export function providerLabel(list: InsuranceProviderConfig[], key: string): string {
  return list.find((e) => e.key === key)?.label ?? key
}

export function defaultCurrencyFor(
  list: InsuranceProviderConfig[],
  key: string,
): Currency {
  return list.find((e) => e.key === key)?.defaultCurrency ?? BASE_CURRENCY
}

/** Match a free-text cell (CSV import) to a configured key by key OR label, case-insensitive. */
export function matchKeyOrLabel(
  list: InsuranceProviderConfig[],
  raw: string,
): string | null {
  const norm = raw.trim().toLowerCase()
  if (!norm) return null
  return (
    list.find((e) => e.key.toLowerCase() === norm)?.key ??
    list.find((e) => e.label.toLowerCase() === norm)?.key ??
    null
  )
}

// --- Key generation + pure transforms ---

/** Slugify a label to a stable key, made unique against `existingKeys` with a numeric suffix. */
export function generateKey(label: string, existingKeys: string[]): string {
  const slug =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'provider'
  const taken = new Set(existingKeys)
  if (!taken.has(slug)) return slug
  let n = 2
  while (taken.has(`${slug}_${n}`)) n += 1
  return `${slug}_${n}`
}

export function addProvider(
  list: InsuranceProviderConfig[],
  label: string,
): InsuranceProviderConfig[] {
  const key = generateKey(
    label,
    list.map((e) => e.key),
  )
  return [...list, { key, label: label.trim(), defaultCurrency: BASE_CURRENCY }]
}

export function renameProvider(
  list: InsuranceProviderConfig[],
  key: string,
  label: string,
): InsuranceProviderConfig[] {
  return list.map((e) => (e.key === key ? { ...e, label: label.trim() } : e))
}

/** Set a provider's default import currency (the per-row currency control). */
export function setProviderCurrency(
  list: InsuranceProviderConfig[],
  key: string,
  defaultCurrency: Currency,
): InsuranceProviderConfig[] {
  return list.map((e) => (e.key === key ? { ...e, defaultCurrency } : e))
}

export function removeProvider(
  list: InsuranceProviderConfig[],
  key: string,
): InsuranceProviderConfig[] {
  return list.filter((e) => e.key !== key)
}

/** Reorder by a list of keys; unknown keys ignored, missing entries kept at the end. */
export function reorderProviders(
  list: InsuranceProviderConfig[],
  keyOrder: string[],
): InsuranceProviderConfig[] {
  const byKey = new Map(list.map((e) => [e.key, e]))
  const seen = new Set<string>()
  const out: InsuranceProviderConfig[] = []
  for (const k of keyOrder) {
    const e = byKey.get(k)
    if (e && !seen.has(k)) {
      out.push(e)
      seen.add(k)
    }
  }
  for (const e of list) if (!seen.has(e.key)) out.push(e)
  return out
}
