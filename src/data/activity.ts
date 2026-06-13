import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'

/** Active (not soft-deleted) activities for the current user, alphabetical. */
export async function listActivities(): Promise<Tables<'activity'>[]> {
  const { data, error } = await supabase
    .from('activity')
    .select('*')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return data
}

export async function getActivity(id: string): Promise<Tables<'activity'> | null> {
  const { data, error } = await supabase
    .from('activity')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createActivity(
  input: TablesInsert<'activity'>,
): Promise<Tables<'activity'>> {
  const { data, error } = await supabase.from('activity').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateActivity(
  id: string,
  patch: TablesUpdate<'activity'>,
): Promise<Tables<'activity'>> {
  const { data, error } = await supabase
    .from('activity')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteActivity(id: string): Promise<void> {
  const { error } = await supabase
    .from('activity')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
