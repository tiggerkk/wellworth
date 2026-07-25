/**
 * Medical configurable-list helpers — pure, unit-tested. The owner can add / rename / delete / reorder
 * the **Report Type** list in Medical Settings; the list is stored as a JSONB array on
 * `profile.medical_report_types` (display order = array order).
 *
 * `medical_report.report_type` stores a stable `key` from this list; only the `label` is editable, so a
 * rename never touches report rows. Lookups fall back to the raw key (orphan tolerance) so a report
 * whose type was deleted still renders + edits.
 *
 * NULL/empty/invalid override ⇒ the canonical seed defaults in `src/constants/medical.ts`. A non-null
 * override is **authoritative and complete** (we do NOT re-append missing canonical defaults) —
 * otherwise a deleted default would resurrect on next load. Net effect:
 *   - never customized (NULL) ⇒ always the current code defaults (incl. any newly-shipped value);
 *   - customized (non-null)   ⇒ exactly the saved list.
 */
import {
  REPORT_TYPE_COLOR_FALLBACK,
  REPORT_TYPE_COLORS,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
} from '../constants/medical'

/** A configurable report type. `color` is optional (legacy rows may lack it — resolve via
 *  `reportTypeColor`), a CSS-var/hex string chosen from `REPORT_TYPE_COLORS`. */
export type MedicalReportTypeConfig = { key: string; label: string; color?: string }

const PALETTE = REPORT_TYPE_COLORS.map((c) => c.value)

/** The default swatch for a type at display position `i` (cycles the palette). */
function paletteColor(i: number): string {
  const n = PALETTE.length
  return PALETTE[((i % n) + n) % n] ?? REPORT_TYPE_COLOR_FALLBACK
}

/** The canonical report-type defaults (seed + NULL fallback), in their display order. */
export function defaultReportTypes(): MedicalReportTypeConfig[] {
  return REPORT_TYPES.map((key, i) => ({
    key,
    label: REPORT_TYPE_LABELS[key],
    color: paletteColor(i),
  }))
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function readEntry(v: unknown): MedicalReportTypeConfig | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  const key = typeof o.key === 'string' ? o.key.trim() : ''
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  if (!key || !label) return null
  const color = typeof o.color === 'string' && o.color.trim() ? o.color.trim() : undefined
  return color ? { key, label, color } : { key, label }
}

/** Resolve the owner's report-type list (override JSONB) → validated configs; NULL/empty ⇒ defaults. */
export function effectiveReportTypes(override: unknown): MedicalReportTypeConfig[] {
  const seen = new Set<string>()
  const out: MedicalReportTypeConfig[] = []
  for (const raw of asArray(override)) {
    const base = readEntry(raw)
    if (!base || seen.has(base.key)) continue
    out.push(base)
    seen.add(base.key)
  }
  return out.length > 0 ? out : defaultReportTypes()
}

/** The configured label for a key, falling back to the raw key (orphan tolerance). */
export function reportTypeLabel(list: MedicalReportTypeConfig[], key: string): string {
  return list.find((e) => e.key === key)?.label ?? key
}

/**
 * The **stable** display colour for a report-type key: its saved `color`, else a deterministic
 * position-based palette colour (so a legacy entry with no stored colour still renders consistently),
 * else the neutral fallback for an orphan key (a deleted type still referenced by a report). Drives the
 * Reports list rows' left-strip colour, keyed by type rather than by row order.
 */
export function reportTypeColor(list: MedicalReportTypeConfig[], key: string): string {
  const i = list.findIndex((e) => e.key === key)
  if (i === -1) return REPORT_TYPE_COLOR_FALLBACK
  return list[i]?.color ?? paletteColor(i)
}

/** The default colour for a newly-added type: the first palette swatch not already in use, else
 *  a position-based cycle so a distinct colour is pre-selected (the owner can change it). */
function nextColor(list: MedicalReportTypeConfig[]): string {
  const used = new Set(list.map((e) => e.color).filter(Boolean))
  return (
    REPORT_TYPE_COLORS.find((c) => !used.has(c.value))?.value ?? paletteColor(list.length)
  )
}

/** Match a free-text cell (structured import) to a configured key by key OR label, case-insensitive. */
export function matchKeyOrLabel(
  list: MedicalReportTypeConfig[],
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

/** Append a new report type with a generated key (duplicate labels allowed; keys stay unique) and a
 *  distinct default colour the owner can then change. */
export function addReportType(
  list: MedicalReportTypeConfig[],
  label: string,
): MedicalReportTypeConfig[] {
  const key = generateKey(
    label,
    list.map((e) => e.key),
  )
  return [...list, { key, label: label.trim(), color: nextColor(list) }]
}

/** Rename changes only the label (the key is immutable, so report rows are untouched). */
export function renameReportType(
  list: MedicalReportTypeConfig[],
  key: string,
  label: string,
): MedicalReportTypeConfig[] {
  return list.map((e) => (e.key === key ? { ...e, label: label.trim() } : e))
}

/** Remove a report type by key. (Reassign in-use reports first; the last type can't be removed — UI.) */
export function removeReportType(
  list: MedicalReportTypeConfig[],
  key: string,
): MedicalReportTypeConfig[] {
  return list.filter((e) => e.key !== key)
}

/** Reorder by a list of keys; unknown keys are ignored, missing entries kept at the end. */
export function reorderReportTypes(
  list: MedicalReportTypeConfig[],
  keyOrder: string[],
): MedicalReportTypeConfig[] {
  const byKey = new Map(list.map((e) => [e.key, e]))
  const seen = new Set<string>()
  const out: MedicalReportTypeConfig[] = []
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
