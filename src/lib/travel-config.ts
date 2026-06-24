/**
 * Travel configurable-list helpers — pure, unit-tested. The owner can add / rename / delete / reorder
 * the **Expense Category** list in Travel Settings; the list is stored as a JSONB array on
 * `profile.travel_expense_categories` (display order = array order). This is the Quotes-category
 * pattern (`src/lib/quotes-config.ts`), trimmed to a single list (Travel has no source types / link
 * kinds).
 *
 * `trip_expense.category` stores a stable `key` from this list; only the `label` is editable, so a
 * rename never touches expense rows. Lookups fall back to the raw key (orphan tolerance) so an expense
 * whose category was deleted still renders + edits.
 *
 * NULL/empty/invalid override ⇒ the canonical seed defaults in `src/constants/travel.ts`. A non-null
 * override is **authoritative and complete** (we do NOT re-append missing canonical defaults) —
 * otherwise a deleted default would resurrect on next load. Net effect:
 *   - never customized (NULL) ⇒ always the current code defaults (incl. any newly-shipped value);
 *   - customized (non-null)   ⇒ exactly the saved list.
 */
import {
  TRAVEL_EXPENSE_CATEGORIES,
  TRAVEL_EXPENSE_CATEGORY_LABELS,
} from '../constants/travel'

export type TravelCategoryConfig = { key: string; label: string }

/** The canonical expense-category defaults (seed + NULL fallback), in their display order. */
export function defaultCategories(): TravelCategoryConfig[] {
  return TRAVEL_EXPENSE_CATEGORIES.map((key) => ({
    key,
    label: TRAVEL_EXPENSE_CATEGORY_LABELS[key],
  }))
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function readEntry(v: unknown): TravelCategoryConfig | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const key = typeof o.key === 'string' ? o.key.trim() : ''
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  return key && label ? { key, label } : null
}

/** Resolve the owner's category list (override JSONB) → validated configs; NULL/empty ⇒ defaults. */
export function effectiveCategories(override: unknown): TravelCategoryConfig[] {
  const seen = new Set<string>()
  const out: TravelCategoryConfig[] = []
  for (const raw of asArray(override)) {
    const base = readEntry(raw)
    if (!base || seen.has(base.key)) continue
    out.push(base)
    seen.add(base.key)
  }
  return out.length > 0 ? out : defaultCategories()
}

/** The configured label for a key, falling back to the raw key (orphan tolerance). */
export function categoryLabel(list: TravelCategoryConfig[], key: string): string {
  return list.find((e) => e.key === key)?.label ?? key
}

/** Match a free-text cell (CSV import) to a configured key by key OR label, case-insensitive. */
export function matchKeyOrLabel(
  list: TravelCategoryConfig[],
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

/** Append a new category with a generated key (duplicate labels allowed; keys stay unique). */
export function addCategory(
  list: TravelCategoryConfig[],
  label: string,
): TravelCategoryConfig[] {
  const key = generateKey(
    label,
    list.map((e) => e.key),
  )
  return [...list, { key, label: label.trim() }]
}

/** Rename changes only the label (the key is immutable, so expense rows are untouched). */
export function renameCategory(
  list: TravelCategoryConfig[],
  key: string,
  label: string,
): TravelCategoryConfig[] {
  return list.map((e) => (e.key === key ? { ...e, label: label.trim() } : e))
}

/** Remove a category by key. (Reassign in-use expenses first; the last category can't be removed — UI.) */
export function removeCategory(
  list: TravelCategoryConfig[],
  key: string,
): TravelCategoryConfig[] {
  return list.filter((e) => e.key !== key)
}

/** Reorder by a list of keys; unknown keys are ignored, missing entries kept at the end. */
export function reorderCategories(
  list: TravelCategoryConfig[],
  keyOrder: string[],
): TravelCategoryConfig[] {
  const byKey = new Map(list.map((e) => [e.key, e]))
  const seen = new Set<string>()
  const out: TravelCategoryConfig[] = []
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
