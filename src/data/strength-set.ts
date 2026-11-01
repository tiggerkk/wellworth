import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

export async function listSetsByEntry(
  entryId: string,
): Promise<Tables<'strength_set'>[]> {
  const { data, error } = await supabase
    .from('strength_set')
    .select('*')
    .eq('entry_id', entryId)
    .order('exercise_order')
    .order('set_number')
  if (error) throw error
  return data
}

/** Ids per `.in()` request — PostgREST sends the list in the URL, so a full diary overflows it. */
const ENTRY_ID_CHUNK = 100

/**
 * All sets for several entries (Multi-Select copy, Diary JSON export), ordered by exercise then
 * set number within each entry. Ids are fetched in parallel chunks to keep each URL short.
 */
export async function listSetsForEntries(
  entryIds: string[],
): Promise<Tables<'strength_set'>[]> {
  if (entryIds.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < entryIds.length; i += ENTRY_ID_CHUNK) {
    chunks.push(entryIds.slice(i, i + ENTRY_ID_CHUNK))
  }
  const results = await Promise.all(
    chunks.map(async (ids) => {
      const { data, error } = await supabase
        .from('strength_set')
        .select('*')
        .in('entry_id', ids)
        .order('exercise_order')
        .order('set_number')
      if (error) throw error
      return data
    }),
  )
  return results.flat()
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
