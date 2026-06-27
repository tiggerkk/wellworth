import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'
import type { AssetType } from '../lib/networth'
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

/** A pre-aggregated per-(month, asset_type) HKD total — one dashboard row from the DB view. */
export interface MonthlyTypeTotal {
  month: string
  asset_type: AssetType
  total_base: number
}

/**
 * Per-(month, asset_type) HKD totals for the Net Worth dashboard, oldest month first. Reads the
 * `networth_monthly_type_total` **view**, which aggregates `asset_entry` in the database — so the
 * payload is O(months × asset_types), NOT every individual holding across all history (which grew
 * unbounded with the asset count). The view is `security_invoker`, so the base tables' RLS scopes
 * rows to the owner; we still filter on `user_id` to match the other queries. Group keys are never
 * null (NOT NULL base columns); `total_base` is coerced via `Number` in case PostgREST returns the
 * numeric sum as a string.
 */
export async function listMonthlyTypeTotals(userId: string): Promise<MonthlyTypeTotal[]> {
  const { data, error } = await supabase
    .from('networth_monthly_type_total')
    .select('month, asset_type, total_base')
    .eq('user_id', userId)
    .order('month', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    month: r.month as string,
    asset_type: r.asset_type as AssetType,
    total_base: Number(r.total_base ?? 0),
  }))
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
