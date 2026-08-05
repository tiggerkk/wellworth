/**
 * Pure parsing + validation for the Diary JSON import — the inverse of
 * `wellness-diary-export.ts`'s `buildDiaryExportData`. No I/O, no external API: the file is
 * always expected to be well-formed (produced by our own Export JSON Diary, or hand-edited from
 * one), so unlike Travel's importer this doesn't attempt tolerant repair of malformed JSON — a
 * `JSON.parse` failure is reported as-is.
 *
 * Shape: an array of `{ day, entries }`. `entries[].group` (one of `DIARY_GROUPS`'s keys)
 * determines `kind` — food groups accept `amount`/`nutrients`; `activities` accepts
 * `duration_min`/`effort`/`exercises`. `sort_order` is optional per entry (defaults to its
 * position in the `entries` array) so a hand-edited file that inserts/removes a row without
 * renumbering the rest still imports in a sane order.
 *
 * A day is the unit of replacement on import (see `ImportDiarySheet` / `data/diary-entry.ts`'s
 * `replaceDiaryDays`): re-importing the same file is naturally idempotent, and there is
 * deliberately no per-entry dedup logic here. A day repeated at the top level is invalid — only
 * its first occurrence is kept, later ones flagged (mirrors Journal's file-level "first occurrence
 * wins" convention).
 *
 * Food/activity linking (`food_id`/`activity_id`) is intentionally **not** resolved here — that
 * needs the user's Food/Activity library (an async fetch), so it happens as a separate step in
 * the import screen, the same way Quotes' Show/Book auto-link and Shows/Books' external-API match
 * are both kept out of their pure parsers.
 */
import { DIARY_GROUPS, type GroupName } from '../constants/wellness'
import { normMatch } from './title-match'
import type { NutrientMap } from './wellness-nutrients'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const GROUP_KEYS = new Set<string>(DIARY_GROUPS.map((g) => g.key))
const GROUP_KIND = new Map<string, 'food' | 'activity'>(
  DIARY_GROUPS.map((g) => [g.key, g.kind]),
)
const EFFORT_KEYS = new Set(['light', 'moderate', 'vigorous'])

export interface ParsedExerciseSet {
  reps: number | null
  weight: number | null
  weight_unit: string
}

export interface ParsedExercise {
  name: string
  sets: ParsedExerciseSet[]
}

export interface ParsedDiaryFoodEntry {
  kind: 'food'
  group: GroupName
  sort_order: number
  label: string
  amount: number | null
  energy_kcal: number
  nutrients: NutrientMap
}

export interface ParsedDiaryActivityEntry {
  kind: 'activity'
  group: GroupName
  sort_order: number
  label: string
  duration_min: number | null
  effort: string | null
  energy_kcal: number
  exercises: ParsedExercise[]
}

export type ParsedDiaryEntry = ParsedDiaryFoodEntry | ParsedDiaryActivityEntry

export interface ParsedDiaryDay {
  day: string
  entries: ParsedDiaryEntry[]
}

export interface DiaryParseResult {
  days: ParsedDiaryDay[]
  errors: string[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function asNutrients(v: unknown): NutrientMap {
  if (!isRecord(v)) return {}
  const out: NutrientMap = {}
  for (const [key, val] of Object.entries(v)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[key] = val
  }
  return out
}

function parseExercises(
  v: unknown,
  dayLabel: string,
  entryLabel: string,
  errors: string[],
): ParsedExercise[] {
  if (v == null) return []
  if (!Array.isArray(v)) {
    errors.push(`${dayLabel}, "${entryLabel}": exercises must be an array — ignored.`)
    return []
  }
  const out: ParsedExercise[] = []
  for (const raw of v) {
    if (!isRecord(raw) || typeof raw.name !== 'string' || raw.name.trim() === '') {
      errors.push(
        `${dayLabel}, "${entryLabel}": an exercise is missing a name — skipped.`,
      )
      continue
    }
    const rawSets = Array.isArray(raw.sets) ? raw.sets : []
    const sets: ParsedExerciseSet[] = rawSets.filter(isRecord).map((s) => ({
      reps: asNumberOrNull(s.reps),
      weight: asNumberOrNull(s.weight),
      weight_unit:
        typeof s.weight_unit === 'string' && s.weight_unit ? s.weight_unit : 'kg',
    }))
    out.push({ name: raw.name.trim(), sets })
  }
  return out
}

function parseEntry(
  raw: unknown,
  dayLabel: string,
  index: number,
  errors: string[],
): ParsedDiaryEntry | null {
  if (!isRecord(raw)) {
    errors.push(`${dayLabel}, entry ${index + 1}: not an object — skipped.`)
    return null
  }
  const group = typeof raw.group === 'string' ? raw.group : ''
  if (!GROUP_KEYS.has(group)) {
    errors.push(
      `${dayLabel}, entry ${index + 1}: unrecognized group "${group}" — skipped.`,
    )
    return null
  }
  const label = typeof raw.label === 'string' ? raw.label.trim() : ''
  if (label === '') {
    errors.push(`${dayLabel}, entry ${index + 1} (${group}): missing label — skipped.`)
    return null
  }
  const sortOrder = asNumberOrNull(raw.sort_order) ?? index
  const energyKcal = asNumberOrNull(raw.energy_kcal) ?? 0

  if (GROUP_KIND.get(group) === 'activity') {
    const effort =
      typeof raw.effort === 'string' && EFFORT_KEYS.has(raw.effort) ? raw.effort : null
    return {
      kind: 'activity',
      group: group as GroupName,
      sort_order: sortOrder,
      label,
      duration_min: asNumberOrNull(raw.duration_min),
      effort,
      energy_kcal: energyKcal,
      exercises: parseExercises(raw.exercises, dayLabel, label, errors),
    }
  }
  return {
    kind: 'food',
    group: group as GroupName,
    sort_order: sortOrder,
    label,
    amount: asNumberOrNull(raw.amount),
    energy_kcal: energyKcal,
    nutrients: asNutrients(raw.nutrients),
  }
}

/** `JSON.parse` wrapper with a clean error message — kept separate from validation so the screen
 *  can show a parse failure before attempting to interpret the (invalid) shape. */
export function parseDiaryJsonText(
  raw: string,
): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(raw) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Couldn’t parse the JSON: ${msg}` }
  }
}

export function validateDiaryData(data: unknown): DiaryParseResult {
  const errors: string[] = []
  if (!Array.isArray(data)) {
    return {
      days: [],
      errors: ['The file must be a JSON array of {day, entries} objects.'],
    }
  }

  const seenDays = new Set<string>()
  const days: ParsedDiaryDay[] = []

  data.forEach((raw, i) => {
    if (!isRecord(raw)) {
      errors.push(`Item ${i + 1}: not an object — skipped.`)
      return
    }
    const day = typeof raw.day === 'string' ? raw.day : ''
    if (!ISO_DATE.test(day)) {
      errors.push(`Item ${i + 1}: day "${day}" must be a date (YYYY-MM-DD) — skipped.`)
      return
    }
    if (seenDays.has(day)) {
      errors.push(`${day}: appears more than once in the file — only the first kept.`)
      return
    }
    seenDays.add(day)

    const rawEntries = Array.isArray(raw.entries) ? raw.entries : []
    const entries: ParsedDiaryEntry[] = []
    rawEntries.forEach((e, idx) => {
      const parsed = parseEntry(e, day, idx, errors)
      if (parsed) entries.push(parsed)
    })
    days.push({ day, entries })
  })

  return { days, errors }
}

/** The `diary_entry` insert row for one parsed entry, once its food/activity link (if any) has
 *  been resolved by the import screen. `user_id` is added by the caller alongside every other
 *  row in the batch insert. */
export interface DiaryEntryInsert {
  day: string
  group_name: GroupName
  kind: 'food' | 'activity'
  food_id: string | null
  activity_id: string | null
  amount: number | null
  duration_min: number | null
  effort: string | null
  energy_kcal: number
  label: string
  nutrients: NutrientMap
  sort_order: number
}

export function buildDiaryEntryInsert(
  day: string,
  entry: ParsedDiaryEntry,
  foodId: string | null,
  activityId: string | null,
): DiaryEntryInsert {
  if (entry.kind === 'activity') {
    return {
      day,
      group_name: entry.group,
      kind: 'activity',
      food_id: null,
      activity_id: activityId,
      amount: null,
      duration_min: entry.duration_min,
      effort: entry.effort,
      energy_kcal: entry.energy_kcal,
      label: entry.label,
      nutrients: {},
      sort_order: entry.sort_order,
    }
  }
  return {
    day,
    group_name: entry.group,
    kind: 'food',
    food_id: foodId,
    activity_id: null,
    amount: entry.amount,
    duration_min: null,
    effort: null,
    energy_kcal: entry.energy_kcal,
    label: entry.label,
    nutrients: entry.nutrients,
    sort_order: entry.sort_order,
  }
}

/** The `strength_set` insert rows for one activity entry's exercises, once its parent
 *  `diary_entry` id is known (after the bulk entry insert returns). Flattens
 *  `exercises[].sets[]` into one row per set, numbering `set_number` per exercise from 1 and
 *  stamping `exercise_order` from the exercise's position in the JSON array, so re-importing
 *  preserves the order the owner entered exercises in. */
export interface StrengthSetInsert {
  entry_id: string
  exercise: string
  exercise_order: number
  set_number: number
  reps: number | null
  weight: number | null
  weight_unit: string
}

export function buildStrengthSetInserts(
  entryId: string,
  exercises: ParsedExercise[],
): StrengthSetInsert[] {
  const rows: StrengthSetInsert[] = []
  exercises.forEach((ex, exIdx) => {
    ex.sets.forEach((s, i) => {
      rows.push({
        entry_id: entryId,
        exercise: ex.name,
        exercise_order: exIdx,
        set_number: i + 1,
        reps: s.reps,
        weight: s.weight,
        weight_unit: s.weight_unit,
      })
    })
  })
  return rows
}

/** Best-effort name match against the user's own Food/Activity library — exact match only (via
 *  `normMatch`, so case/whitespace/CJK-variant differences don't block a match), no fuzzy
 *  scoring: unlike Shows/Books' external-API matching, there's no ambiguity to rank between
 *  candidates worth surfacing for review, just "found it" or "didn't" against the owner's own
 *  data. A tie (two foods/activities sharing a normalized name) resolves to whichever the caller's
 *  map last held for that key. Returns `null` on no match — the entry still imports, just
 *  unlinked, which `diary_entry` already treats as a fully valid state (see
 *  `wellness-diary-export.ts`'s header comment). */
export function matchByName(
  label: string,
  idByNormName: Map<string, string>,
): string | null {
  return idByNormName.get(normMatch(label)) ?? null
}
