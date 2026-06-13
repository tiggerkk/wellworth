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
