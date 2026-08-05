/**
 * Pure JSON-building for the Diary export — the inverse of `wellness-diary-import.ts`'s
 * `parseDiaryJson`. Groups entries by `day` (one object per day, `entries` nested inside), so a
 * file produced here re-imports unchanged via Import JSON Diary — which replaces a day's entries
 * wholesale rather than merging, matching the file's own day-scoped shape.
 *
 * `group` alone determines `kind` (`DIARY_GROUPS`) — no separate `kind` field. Food-only fields
 * (`amount`, `nutrients`) are omitted from an activity entry and vice versa
 * (`duration_min`/`effort`/`exercises`); `exercises` itself is omitted entirely when the entry has
 * no strength sets, rather than exported as `[]`.
 *
 * `sort_order` is re-numbered to each entry's 0-based position within its day, not the raw DB
 * value — which entries logged after a drag-reorder use as a huge `Date.now()`-scale number (see
 * `data/diary-entry.ts`) — so the file stays small and hand-editable. Which specific serving a
 * food entry used isn't exported (already not persisted anywhere — `diary_entry.serving_id` is a
 * schema column the app never actually writes to, see `04_wellness.md`).
 *
 * `strengthSets` is the flat result of `data/strength-set.ts`'s `listSetsForEntries` (already
 * used elsewhere for a bulk fetch across several entries) — grouped by `entry_id` here rather
 * than requiring the caller to pre-group it.
 *
 * No I/O.
 */
import type { GroupName } from '../constants/wellness'
import type { Tables } from '../types/database'
import type { NutrientMap } from './wellness-nutrients'

type DiaryEntryRow = Tables<'diary_entry'>
type StrengthSetRow = Tables<'strength_set'>

export interface DiaryExportExercise {
  name: string
  sets: { reps: number | null; weight: number | null; weight_unit: string | null }[]
}

export interface DiaryExportEntry {
  group: GroupName
  sort_order: number
  label: string
  energy_kcal: number
  amount?: number | null
  nutrients?: NutrientMap
  duration_min?: number | null
  effort?: string | null
  exercises?: DiaryExportExercise[]
}

export interface DiaryExportDay {
  day: string
  entries: DiaryExportEntry[]
}

/** Group a food entry's `exercise`-named sets (from `strength_set`, already `set_number`
 *  ordered) into one export block per distinct exercise name, in first-seen order. */
function groupExercises(sets: StrengthSetRow[]): DiaryExportExercise[] {
  const byName = new Map<string, DiaryExportExercise>()
  for (const s of sets) {
    let group = byName.get(s.exercise)
    if (!group) {
      group = { name: s.exercise, sets: [] }
      byName.set(s.exercise, group)
    }
    group.sets.push({ reps: s.reps, weight: s.weight, weight_unit: s.weight_unit })
  }
  return [...byName.values()]
}

function toExportEntry(
  entry: DiaryEntryRow,
  sets: StrengthSetRow[],
  sortOrder: number,
): DiaryExportEntry {
  const base = {
    group: entry.group_name as GroupName,
    sort_order: sortOrder,
    label: entry.label,
    energy_kcal: entry.energy_kcal,
  }
  if (entry.kind === 'activity') {
    const exercises = groupExercises(sets)
    return {
      ...base,
      duration_min: entry.duration_min,
      effort: entry.effort,
      ...(exercises.length > 0 ? { exercises } : {}),
    }
  }
  return {
    ...base,
    amount: entry.amount,
    nutrients: (entry.nutrients ?? {}) as NutrientMap,
  }
}

export function buildDiaryExportData(
  entries: DiaryEntryRow[],
  strengthSets: StrengthSetRow[],
): DiaryExportDay[] {
  const setsByEntry = new Map<string, StrengthSetRow[]>()
  for (const s of strengthSets) {
    const group = setsByEntry.get(s.entry_id)
    if (group) group.push(s)
    else setsByEntry.set(s.entry_id, [s])
  }

  const sorted = [...entries].sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at),
  )

  const days: DiaryExportDay[] = []
  let current: DiaryExportDay | null = null
  for (const entry of sorted) {
    if (!current || current.day !== entry.day) {
      current = { day: entry.day, entries: [] }
      days.push(current)
    }
    const sets = setsByEntry.get(entry.id) ?? []
    current.entries.push(toExportEntry(entry, sets, current.entries.length))
  }
  return days
}
