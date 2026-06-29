import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'

/**
 * All entries for a single day. `day` is an ISO date (YYYY-MM-DD). Ordered by `sort_order` then
 * `created_at`, so a group the user has manually reordered honours that order while un-reordered
 * groups keep insertion order (every new row defaults to a large `Date.now()` sort_order — see
 * `createEntry`).
 */
export async function listEntriesByDay(
  userId: string,
  day: string,
): Promise<Tables<'diary_entry'>[]> {
  const { data, error } = await supabase
    .from('diary_entry')
    .select('*')
    .eq('user_id', userId)
    .eq('day', day)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data
}

/** Entries across an inclusive date range — used by the Dashboard's averaged views. */
export async function listEntriesByRange(
  userId: string,
  from: string,
  to: string,
): Promise<Tables<'diary_entry'>[]> {
  const { data, error } = await supabase
    .from('diary_entry')
    .select('*')
    .eq('user_id', userId)
    .gte('day', from)
    .lte('day', to)
    .order('day')
  if (error) throw error
  return data
}

/**
 * Insert a new logged item. When the caller omits `sort_order` it defaults to `Date.now()` — a large
 * epoch value so a freshly logged item appends after any rows the user has dragged into order (a
 * reorder renumbers a group's rows to small 0..n indices). See `listEntriesByDay`.
 */
export async function createEntry(
  input: TablesInsert<'diary_entry'>,
): Promise<Tables<'diary_entry'>> {
  const { data, error } = await supabase
    .from('diary_entry')
    .insert({ sort_order: Date.now(), ...input })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Persist a new order for a group's entries (sort_order = array index). */
export async function reorderEntries(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, i) => updateEntry(id, { sort_order: i })))
}

export async function getEntry(id: string): Promise<Tables<'diary_entry'> | null> {
  const { data, error } = await supabase
    .from('diary_entry')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Update an existing diary entry (editing a logged item). */
export async function updateEntry(
  id: string,
  patch: TablesUpdate<'diary_entry'>,
): Promise<Tables<'diary_entry'>> {
  const { data, error } = await supabase
    .from('diary_entry')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Whether any diary entry still references this food — gates hard- vs soft-delete of the food. */
export async function foodHasEntries(foodId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('diary_entry')
    .select('id', { count: 'exact', head: true })
    .eq('food_id', foodId)
  if (error) throw error
  return (count ?? 0) > 0
}

/** Hard delete — strength_set rows cascade. The diary log is the user's own data. */
export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('diary_entry').delete().eq('id', id)
  if (error) throw error
}

/** Hard-delete every entry for a day (the day-header Delete action). strength_set rows cascade. */
export async function deleteEntriesByDay(userId: string, day: string): Promise<void> {
  const { error } = await supabase
    .from('diary_entry')
    .delete()
    .eq('user_id', userId)
    .eq('day', day)
  if (error) throw error
}

/** Hard-delete every entry in one group on a day (a group header's Delete). strength_set rows cascade. */
export async function deleteEntriesByGroup(
  userId: string,
  day: string,
  group: string,
): Promise<void> {
  const { error } = await supabase
    .from('diary_entry')
    .delete()
    .eq('user_id', userId)
    .eq('day', day)
    .eq('group_name', group)
  if (error) throw error
}

/**
 * Clone specific entries onto a target day (Copy → Paste), ADDING to whatever is already there.
 * Snapshots (nutrients/energy/label) copy as-is, and strength entries also clone their
 * `strength_set` children onto the new entry ids. `setsByEntry` is keyed by source entry id; the
 * insert preserves input order, so each clone links to its source's sets by position. Clones are
 * stamped with ascending `sort_order` (a large `Date.now()` base) so pasted items append in order
 * after any existing rows. `opts.groupOverride` forces every clone into one group (a group-level
 * Paste); omit it to keep each entry's own `group_name` (a day-level Paste). Returns the number of
 * entries created.
 */
export async function cloneEntriesToDay(
  userId: string,
  toDay: string,
  entries: Tables<'diary_entry'>[],
  setsByEntry: Record<string, Tables<'strength_set'>[]> = {},
  opts: { groupOverride?: string } = {},
): Promise<number> {
  if (entries.length === 0) return 0

  const base = Date.now()
  const clones: TablesInsert<'diary_entry'>[] = entries.map((e, i) => ({
    user_id: userId,
    day: toDay,
    group_name: opts.groupOverride ?? e.group_name,
    kind: e.kind,
    food_id: e.food_id,
    activity_id: e.activity_id,
    serving_id: e.serving_id,
    amount: e.amount,
    duration_min: e.duration_min,
    effort: e.effort,
    energy_kcal: e.energy_kcal,
    label: e.label,
    nutrients: e.nutrients,
    sort_order: base + i,
  }))
  const { data: inserted, error } = await supabase
    .from('diary_entry')
    .insert(clones)
    .select('id')
  if (error) throw error

  const setRows = (inserted ?? []).flatMap((row, i) => {
    const sets = entries[i] ? (setsByEntry[entries[i]!.id] ?? []) : []
    return sets.map((s) => ({
      entry_id: row.id,
      exercise: s.exercise,
      set_number: s.set_number,
      reps: s.reps,
      weight: s.weight,
      weight_unit: s.weight_unit,
    }))
  })
  if (setRows.length > 0) {
    const { error: setError } = await supabase.from('strength_set').insert(setRows)
    if (setError) throw setError
  }
  return clones.length
}
