import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'
import { createSnapshot, getSnapshotByMonth } from './networth-snapshot'

export async function listEntriesBySnapshot(
  snapshotId: string,
): Promise<Tables<'asset_entry'>[]> {
  const { data, error } = await supabase
    .from('asset_entry')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .order('sort_order', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export interface SnapshotWithEntries {
  snapshot: Tables<'networth_snapshot'>
  entries: Tables<'asset_entry'>[]
}

/** A month's snapshot together with its asset entries, or null if the month has none. */
export async function getSnapshotWithEntries(
  userId: string,
  month: string,
): Promise<SnapshotWithEntries | null> {
  const snapshot = await getSnapshotByMonth(userId, month)
  if (!snapshot) return null
  const entries = await listEntriesBySnapshot(snapshot.id)
  return { snapshot, entries }
}

/** Minimal per-month rollup for the Net Worth dashboard (all months, oldest first). */
export interface SnapshotEntries {
  month: string
  entries: { value_base: number; asset_type: string }[]
}

/**
 * Every snapshot with just its entries' `value_base` + `asset_type`, via one embedded select.
 * Net-worth data is small (≈monthly), so the dashboard fetches all and slices the time window
 * client-side. RLS scopes both tables to the owner.
 */
export async function listSnapshotsWithEntries(
  userId: string,
): Promise<SnapshotEntries[]> {
  const { data, error } = await supabase
    .from('networth_snapshot')
    .select('month, asset_entry(value_base, asset_type)')
    .eq('user_id', userId)
    .order('month', { ascending: true })
  if (error) throw error
  return (data ?? []).map((s) => ({ month: s.month, entries: s.asset_entry ?? [] }))
}

/** Caller-supplied entry to persist (snapshot_id + user_id are filled in by the save). */
export type AssetEntryInput = Omit<TablesInsert<'asset_entry'>, 'snapshot_id' | 'user_id'>

/**
 * Create-or-replace a month's entries: ensure the month's snapshot exists, delete its current
 * `asset_entry` rows, then insert the supplied set. **Idempotent per month** — re-running for a
 * month replaces its entries, never duplicating them. Mirrors `data/serving.replaceServings`;
 * reused by the CSV importer (M6).
 *
 * NOTE: the delete-then-insert is not transactional (acceptable for a solo app — the same
 * trade-off as `replaceServings`; a transactional RPC is a later nicety).
 */
export async function saveSnapshotEntries(
  userId: string,
  month: string,
  rows: AssetEntryInput[],
): Promise<void> {
  const snapshot =
    (await getSnapshotByMonth(userId, month)) ??
    (await createSnapshot({ user_id: userId, month }))

  const { error: delError } = await supabase
    .from('asset_entry')
    .delete()
    .eq('snapshot_id', snapshot.id)
  if (delError) throw delError

  if (rows.length === 0) return
  const { error } = await supabase.from('asset_entry').insert(
    rows.map((r, i) => ({
      ...r,
      snapshot_id: snapshot.id,
      user_id: userId,
      sort_order: r.sort_order ?? i,
    })),
  )
  if (error) throw error
}
