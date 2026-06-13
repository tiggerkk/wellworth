import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

/** All entries for a single day, in insertion order. `day` is an ISO date (YYYY-MM-DD). */
export async function listEntriesByDay(
  userId: string,
  day: string,
): Promise<Tables<'diary_entry'>[]> {
  const { data, error } = await supabase
    .from('diary_entry')
    .select('*')
    .eq('user_id', userId)
    .eq('day', day)
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

export async function createEntry(
  input: TablesInsert<'diary_entry'>,
): Promise<Tables<'diary_entry'>> {
  const { data, error } = await supabase
    .from('diary_entry')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Hard delete — strength_set rows cascade. The diary log is the user's own data. */
export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('diary_entry').delete().eq('id', id)
  if (error) throw error
}

/**
 * Clone every entry from one day onto another (the ⋯-menu copy actions). Snapshots
 * (nutrients/energy/label) are copied as-is. Strength sets are not duplicated.
 * Returns the number of entries copied.
 */
export async function copyEntriesToDay(
  userId: string,
  from: string,
  to: string,
): Promise<number> {
  const source = await listEntriesByDay(userId, from)
  if (source.length === 0) return 0

  const clones: TablesInsert<'diary_entry'>[] = source.map((e) => ({
    user_id: userId,
    day: to,
    group_name: e.group_name,
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
  }))
  const { error } = await supabase.from('diary_entry').insert(clones)
  if (error) throw error
  return clones.length
}
