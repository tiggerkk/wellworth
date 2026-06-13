import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'
import { OWNER_SEED_ACTIVITIES } from '../constants/seed-activities'

/**
 * Seed the owner's starter activity library on first login. No-op if the user already
 * has any activity (so it never re-creates deleted ones). Single-user assumption — see
 * OWNER_SEED_ACTIVITIES for the multi-user note.
 */
export async function ensureOwnerActivities(userId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('activity')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (countError) throw countError
  if (count && count > 0) return

  const rows = OWNER_SEED_ACTIVITIES.map((a) => ({ ...a, user_id: userId }))
  const { error } = await supabase.from('activity').insert(rows)
  if (error) throw error
}

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
