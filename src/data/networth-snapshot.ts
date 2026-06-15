import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

/** All of a user's snapshots, oldest month first. */
export async function listSnapshots(
  userId: string,
): Promise<Tables<'networth_snapshot'>[]> {
  const { data, error } = await supabase
    .from('networth_snapshot')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: true })
  if (error) throw error
  return data
}

/** The snapshot for a given month (1st-of-month date), or null. */
export async function getSnapshotByMonth(
  userId: string,
  month: string,
): Promise<Tables<'networth_snapshot'> | null> {
  const { data, error } = await supabase
    .from('networth_snapshot')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle()
  if (error) throw error
  return data
}

/** The most recent snapshot strictly before `month` — the copy-forward source. */
export async function getLatestSnapshotBefore(
  userId: string,
  month: string,
): Promise<Tables<'networth_snapshot'> | null> {
  const { data, error } = await supabase
    .from('networth_snapshot')
    .select('*')
    .eq('user_id', userId)
    .lt('month', month)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createSnapshot(
  input: TablesInsert<'networth_snapshot'>,
): Promise<Tables<'networth_snapshot'>> {
  const { data, error } = await supabase
    .from('networth_snapshot')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSnapshot(id: string): Promise<void> {
  const { error } = await supabase.from('networth_snapshot').delete().eq('id', id)
  if (error) throw error
}
