/**
 * Chinese dynasty enum — a reusable ordered list (newest → oldest) shared by Shows & Books today
 * and by future modules. The value === the label (the Chinese name itself), so dropdown options
 * map each entry to `{ value: d, label: d }`. A dynasty is stored only for Chinese-titled records;
 * non-Chinese records store `null` (see `containsCjk` in `src/lib/cjk.ts`).
 */
export const DYNASTIES = [
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

/** The default selection when a Chinese title first enables the field. */
export const DEFAULT_DYNASTY: Dynasty = DYNASTIES[0]

/** Gold/amber badge (design-system token `--color-dynasty`); dark text for contrast. */
export const DYNASTY_CHIP = 'bg-dynasty text-bg'
