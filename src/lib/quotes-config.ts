/**
 * Quotes configurable-list helpers (M8) — pure, unit-tested. The owner can add / rename / delete /
 * reorder the **Source Type** and **Category** lists in Quotes Settings; the lists are stored as JSONB
 * arrays on `profile.quote_source_types` / `profile.quote_categories` (display order = array order).
 *
 * `quote.source_type` / `quote.category` store a stable `key` from these lists; only the `label` is
 * editable, so a rename never touches quote rows. Lookups fall back to the raw key (orphan tolerance,
 * like medical's `testDisplayName`) so a quote whose value was deleted still renders + edits.
 *
 * NULL/empty/invalid override ⇒ the canonical seed defaults in `src/constants/quotes.ts`. Unlike the
 * medical order model, a non-null override is **authoritative and complete** (we do NOT re-append
 * missing canonical defaults) — otherwise a deleted default would resurrect on next load. Net effect:
 *   - never customized (NULL) ⇒ always the current code defaults (incl. any newly-shipped value);
 *   - customized (non-null)   ⇒ exactly the saved list.
 */
import {
  QUOTE_CATEGORIES,
  QUOTE_CATEGORY_COLOR_FALLBACK,
  QUOTE_CATEGORY_COLORS,
  QUOTE_CATEGORY_LABELS,
  QUOTE_SOURCE_TYPES,
  QUOTE_SOURCE_TYPE_LABELS,
} from '../constants/quotes'

/** What a source type auto-links a quote to in the Shows/Books library (null = no auto-link). */
export type SourceLinkKind = 'show' | 'book' | null

export type QuoteSourceTypeConfig = {
  key: string
  label: string
  linkKind: SourceLinkKind
}
/** A configurable category. `color` is optional (legacy rows may lack it — resolve via
 *  `categoryColor`), a CSS-var/hex string chosen from `QUOTE_CATEGORY_COLORS`. */
export type QuoteCategoryConfig = { key: string; label: string; color?: string }

const CATEGORY_PALETTE = QUOTE_CATEGORY_COLORS.map((c) => c.value)

/** The default swatch for a category at display position `i` (cycles the palette). */
function paletteColor(i: number): string {
  const n = CATEGORY_PALETTE.length
  return CATEGORY_PALETTE[((i % n) + n) % n] ?? QUOTE_CATEGORY_COLOR_FALLBACK
}

/** The seeded source types' built-in link behavior, keyed by the canonical key. */
function defaultLinkKind(key: string): SourceLinkKind {
  if (key === 'tv' || key === 'movie') return 'show'
  if (key === 'book') return 'book'
  return null
}

/** The canonical Source Type / Category defaults (seed + NULL fallback), in their display order. */
export function defaultSourceTypes(): QuoteSourceTypeConfig[] {
  return QUOTE_SOURCE_TYPES.map((key) => ({
    key,
    label: QUOTE_SOURCE_TYPE_LABELS[key],
    linkKind: defaultLinkKind(key),
  }))
}

export function defaultCategories(): QuoteCategoryConfig[] {
  return QUOTE_CATEGORIES.map((key, i) => ({
    key,
    label: QUOTE_CATEGORY_LABELS[key],
    color: paletteColor(i),
  }))
}

/**
 * The source types whose Show/Book auto-linking must keep working — protected from deletion (rename
 * and reorder stay allowed). These are exactly the seeded keys with a non-null `linkKind`.
 */
export function isProtectedSourceKey(key: string): boolean {
  return defaultLinkKind(key) !== null
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function readEntry(v: unknown): { key: string; label: string } | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const key = typeof o.key === 'string' ? o.key.trim() : ''
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  return key && label ? { key, label } : null
}

function readCategoryEntry(v: unknown): QuoteCategoryConfig | null {
  const base = readEntry(v)
  if (!base) return null
  const o = v as Record<string, unknown>
  const color = typeof o.color === 'string' && o.color.trim() ? o.color.trim() : undefined
  return color ? { ...base, color } : base
}

/** Resolve the owner's source-type list (override JSONB) → validated configs; NULL/empty ⇒ defaults. */
export function effectiveSourceTypes(override: unknown): QuoteSourceTypeConfig[] {
  const seen = new Set<string>()
  const out: QuoteSourceTypeConfig[] = []
  for (const raw of asArray(override)) {
    const base = readEntry(raw)
    if (!base || seen.has(base.key)) continue
    const lk = (raw as Record<string, unknown>).linkKind
    // A canonical key keeps its built-in linkKind (label stays the owner's), so Show/Book
    // auto-linking can never be broken by a stale or hand-edited override.
    const linkKind = isProtectedSourceKey(base.key)
      ? defaultLinkKind(base.key)
      : lk === 'show' || lk === 'book'
        ? lk
        : null
    out.push({ ...base, linkKind })
    seen.add(base.key)
  }
  return out.length > 0 ? out : defaultSourceTypes()
}

/** Resolve the owner's category list (override JSONB) → validated configs; NULL/empty ⇒ defaults. */
export function effectiveCategories(override: unknown): QuoteCategoryConfig[] {
  const seen = new Set<string>()
  const out: QuoteCategoryConfig[] = []
  for (const raw of asArray(override)) {
    const base = readCategoryEntry(raw)
    if (!base || seen.has(base.key)) continue
    out.push(base)
    seen.add(base.key)
  }
  return out.length > 0 ? out : defaultCategories()
}

// --- Tolerant lookups (raw-key fallback) ---

export function sourceTypeLabel(list: QuoteSourceTypeConfig[], key: string): string {
  return list.find((e) => e.key === key)?.label ?? key
}

export function categoryLabel(list: QuoteCategoryConfig[], key: string): string {
  return list.find((e) => e.key === key)?.label ?? key
}

/**
 * The **stable** display colour for a category key: its saved `color`, else a deterministic
 * position-based palette colour (so a legacy entry with no stored colour still renders consistently),
 * else the neutral fallback for an orphan key (a deleted category still referenced by a quote). Drives
 * the left-strip accent on each row in the Quotes Library.
 */
export function categoryColor(list: QuoteCategoryConfig[], key: string): string {
  const i = list.findIndex((e) => e.key === key)
  if (i === -1) return QUOTE_CATEGORY_COLOR_FALLBACK
  return list[i]?.color ?? paletteColor(i)
}

export function linkKindFor(list: QuoteSourceTypeConfig[], key: string): SourceLinkKind {
  return list.find((e) => e.key === key)?.linkKind ?? null
}

/** Match a free-text cell (CSV import) to a configured key by key OR label, case-insensitive. */
export function matchKeyOrLabel(
  list: { key: string; label: string }[],
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

// --- Key generation + pure transforms (shared across both lists by key) ---

/** Slugify a label to a stable key, made unique against `existingKeys` with a numeric suffix. */
export function generateKey(label: string, existingKeys: string[]): string {
  const slug =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'value'
  const taken = new Set(existingKeys)
  if (!taken.has(slug)) return slug
  let n = 2
  while (taken.has(`${slug}_${n}`)) n += 1
  return `${slug}_${n}`
}

function renameEntry<T extends { key: string; label: string }>(
  list: T[],
  key: string,
  label: string,
): T[] {
  return list.map((e) => (e.key === key ? { ...e, label: label.trim() } : e))
}

function removeEntry<T extends { key: string }>(list: T[], key: string): T[] {
  return list.filter((e) => e.key !== key)
}

/** Reorder by a list of keys; unknown keys in `keyOrder` are ignored, missing entries kept at the end. */
function reorderEntries<T extends { key: string }>(list: T[], keyOrder: string[]): T[] {
  const byKey = new Map(list.map((e) => [e.key, e]))
  const seen = new Set<string>()
  const out: T[] = []
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

export function addSourceType(
  list: QuoteSourceTypeConfig[],
  label: string,
): QuoteSourceTypeConfig[] {
  const key = generateKey(
    label,
    list.map((e) => e.key),
  )
  return [...list, { key, label: label.trim(), linkKind: null }]
}

export const renameSourceType = (
  list: QuoteSourceTypeConfig[],
  key: string,
  label: string,
) => renameEntry(list, key, label)
export const removeSourceType = (list: QuoteSourceTypeConfig[], key: string) =>
  removeEntry(list, key)
export const reorderSourceTypes = (list: QuoteSourceTypeConfig[], keyOrder: string[]) =>
  reorderEntries(list, keyOrder)

/** The default colour for a newly-added category: the first palette swatch not already in use, else
 *  a position-based cycle so a distinct colour is pre-selected (the owner can change it). */
function nextCategoryColor(list: QuoteCategoryConfig[]): string {
  const used = new Set(list.map((e) => e.color).filter(Boolean))
  return (
    QUOTE_CATEGORY_COLORS.find((c) => !used.has(c.value))?.value ??
    paletteColor(list.length)
  )
}

export function addCategory(
  list: QuoteCategoryConfig[],
  label: string,
): QuoteCategoryConfig[] {
  const key = generateKey(
    label,
    list.map((e) => e.key),
  )
  return [...list, { key, label: label.trim(), color: nextCategoryColor(list) }]
}

export const renameCategory = (list: QuoteCategoryConfig[], key: string, label: string) =>
  renameEntry(list, key, label)
export const removeCategory = (list: QuoteCategoryConfig[], key: string) =>
  removeEntry(list, key)
export const reorderCategories = (list: QuoteCategoryConfig[], keyOrder: string[]) =>
  reorderEntries(list, keyOrder)
