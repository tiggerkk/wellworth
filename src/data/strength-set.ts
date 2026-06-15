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

/** All sets for several entries (Multi-Select copy of strength activities), by set number. */
export async function listSetsForEntries(
  entryIds: string[],
): Promise<Tables<'strength_set'>[]> {
  if (entryIds.length === 0) return []
  const { data, error } = await supabase
    .from('strength_set')
    .select('*')
    .in('entry_id', entryIds)
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

/** Replace a strength entry's sets (delete all, re-insert) — used when editing an entry. */
export async function replaceSets(
  entryId: string,
  sets: TablesInsert<'strength_set'>[],
): Promise<void> {
  const { error: delError } = await supabase
    .from('strength_set')
    .delete()
    .eq('entry_id', entryId)
  if (delError) throw delError
  if (sets.length === 0) return
  const { error } = await supabase.from('strength_set').insert(sets)
  if (error) throw error
}
