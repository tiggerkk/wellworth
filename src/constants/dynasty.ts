/**
 * Chinese dynasty enum — a reusable ordered list shared by Shows & Books today and by future
 * modules. `全部` ("all") leads as a catch-all for titles that span every era (e.g. a survey
 * series); the rest run newest → oldest. The value === the label (the Chinese name itself), so
 * dropdown options map each entry to `{ value: d, label: d }`. A dynasty is stored only for
 * Chinese-titled records; non-Chinese records store `null` (see `containsCjk` in `src/lib/cjk.ts`).
 */
export const DYNASTIES = [
  '全部',
  '近代',
  '清代',
  '明代',
  '元代',
  '宋代',
  '五代',
  '唐代',
  '隋代',
  '南北朝',
  '魏晉',
  '兩漢',
  '先秦',
] as const

export type Dynasty = (typeof DYNASTIES)[number]

/** The default selection when a Chinese title first enables the field (the leading `全部`). */
export const DEFAULT_DYNASTY: Dynasty = DYNASTIES[0]

/** Gold/amber badge (design-system token `--color-dynasty`); dark text for contrast. */
export const DYNASTY_CHIP = 'bg-dynasty text-bg'

/**
 * Sort rank for the Library **Dynasty sort** — the reverse of the display order, so a chronological
 * sort runs oldest → newest: `先秦` (smallest) … `近代` … `全部` (largest — the catch-all sorts to the
 * recent end). Ascending ⇒ `先秦` first / `全部` last; descending flips it. A non-Chinese title (value
 * not in the list, incl. `null`) returns `null`, and the caller sorts those last regardless of
 * direction. Display order (dropdowns/default) still comes from `DYNASTIES` itself — the two are
 * intentionally opposite, both driven by the one `DYNASTIES` list.
 */
const DYNASTY_SORT_ORDER = [...DYNASTIES].reverse() as readonly Dynasty[]

export function dynastySortRank(dynasty: string | null): number | null {
  const i = DYNASTY_SORT_ORDER.indexOf(dynasty as Dynasty)
  return i >= 0 ? i : null
}
