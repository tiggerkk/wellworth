import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

/** The single most recent snapshot (highest month), or null. Used by the Dashboard's "latest
 *  month" figures (current total, funds, insurance agg) — avoids fetching every snapshot row
 *  across all history just to read the last one; this grows unbounded with months of use, the
 *  same class of issue `networth_monthly_type_total` was introduced to fix for `asset_entry`. */
export async function getLatestSnapshot(
  userId: string,
): Promise<Tables<'networth_snapshot'> | null> {
  const { data, error } = await supabase
    .from('networth_snapshot')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
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
