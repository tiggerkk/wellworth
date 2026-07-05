import { MODULES, type ModuleDef } from '../constants/modules'

/**
 * Resolve the per-profile Home-hub module list from the two `profile` columns:
 *   - `module_order`   — ordered module keys; NULL/empty = canonical `MODULES` order. It also doubles
 *     as the set of modules the user has **seen** (the Visible Modules sheet always writes it whenever
 *     visibility changes), so a newly-shipped module — absent from a stored order — defaults to visible.
 *   - `visible_modules` — module keys shown on the hub; NULL = all visible (same as the
 *     `*_visible_fields` columns). The Visible Modules sheet guarantees ≥1 visible.
 *
 * Both are tolerant: unknown stored keys are dropped, and any module missing from a stored order
 * (e.g. a newly-shipped module after a redeploy) is appended in its canonical position — so the
 * ordering always covers every module exactly once and a new module can't disappear from reorder.
 *
 * The canonical fallback below only shows on a truly first-ever load: `useProfile` seeds from a local
 * cache of the last-known profile, so a returning user's saved order paints on the first render (no
 * reorder flash) rather than this default flashing before the fetch resolves.
 */

/** All modules in the user's chosen order (newly-shipped modules appended in canonical order). */
export function orderedModules(moduleOrder: string[] | null | undefined): ModuleDef[] {
  if (!moduleOrder || moduleOrder.length === 0) return MODULES
  const remaining = new Map(MODULES.map((m) => [m.key, m]))
  const ordered: ModuleDef[] = []
  for (const key of moduleOrder) {
    const m = remaining.get(key)
    if (m) {
      ordered.push(m)
      remaining.delete(key)
    }
  }
  // Append modules not present in the stored order, keeping their canonical relative order.
  for (const m of MODULES) if (remaining.has(m.key)) ordered.push(m)
  return ordered
}

/** The module keys in the user's chosen order — what the Visible Modules reorder list edits. */
export function orderedModuleKeys(moduleOrder: string[] | null | undefined): string[] {
  return orderedModules(moduleOrder).map((m) => m.key)
}

/**
 * The modules shown on the Home hub, filtered by visibility and in the chosen order. A module is
 * shown if it's explicitly in `visibleModules` **or** it isn't in the seen-set (`moduleOrder`) — so a
 * newly-shipped module defaults to visible even for a user who has already customized their selection.
 */
export function homeModules(
  moduleOrder: string[] | null | undefined,
  visibleModules: string[] | null | undefined,
): ModuleDef[] {
  const ordered = orderedModules(moduleOrder)
  if (!visibleModules) return ordered // NULL = all visible
  const visible = new Set(visibleModules)
  const seen = new Set(moduleOrder ?? [])
  return ordered.filter((m) => visible.has(m.key) || !seen.has(m.key))
}
