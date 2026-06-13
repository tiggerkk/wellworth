import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

export async function listSetsByEntry(
  entryId: string,
): Promise<Tables<'strength_set'>[]> {
  const { data, error } = await supabase
    .from('strength_set')
    .select('*')
    .eq('entry_id', entryId)
    .order('set_number')
  if (error) throw error
  return data
}

/** Insert all sets for a strength entry in one round-trip. */
export async function createSets(
  sets: TablesInsert<'strength_set'>[],
): Promise<Tables<'strength_set'>[]> {
  const { data, error } = await supabase.from('strength_set').insert(sets).select()
  if (error) throw error
  return data
}
