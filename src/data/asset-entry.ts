import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'
import {
  ageForYear,
  originalCashValueAtAge,
  resolvePolicyAtAge,
  surrenderGainPctPerYear,
  varianceAtAge,
  type AssetType,
} from '../lib/networth'
import { startOfMonth } from '../lib/date'
import {
  createSnapshot,
  getLatestSnapshotBefore,
  getSnapshotByMonth,
} from './networth-snapshot'
import { listCatalogue, type PolicyWithSchedules } from './insurance'

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

/** A single asset entry by id (for the Fund detail drill-in), or null. */
export async function getAssetEntry(id: string): Promise<Tables<'asset_entry'> | null> {
  const { data, error } = await supabase
    .from('asset_entry')
    .select('*')
    .eq('id', id)
    .maybeSingle()
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

/** Project a stored row back to the save-input shape (drops id/snapshot/user/timestamps). */
export function entryToInput(e: Tables<'asset_entry'>): AssetEntryInput {
  return {
    asset_type: e.asset_type,
    name: e.name,
    currency: e.currency,
    details: e.details,
    value_native: e.value_native,
    fx_rate_to_base: e.fx_rate_to_base,
    value_base: e.value_base,
    sort_order: e.sort_order,
  }
}

/**
 * Replace just one asset type's rows for a month, preserving every other entry. Used by the Fund
 * monthly importer (overwrites the month's `fund` rows without touching manual/insurance rows).
 */
export async function replaceAssetTypeEntries(
  userId: string,
  month: string,
  assetType: AssetType,
  rows: AssetEntryInput[],
): Promise<void> {
  const existing = await getSnapshotWithEntries(userId, month)
  const kept = (existing?.entries ?? [])
    .filter((e) => e.asset_type !== assetType)
    .map(entryToInput)
  await saveSnapshotEntries(userId, month, [...kept, ...rows])
}

/** Resolve the catalogue into frozen `insurance` rows for a month (same as Monthly Entry's SAVE). */
export function buildResolvedInsuranceEntries(
  catalogue: PolicyWithSchedules[],
  month: string,
  birthYear: number,
  rates: { usd: number; cny: number },
): AssetEntryInput[] {
  const age = ageForYear(Number(month.slice(0, 4)), birthYear)
  const out: AssetEntryInput[] = []
  let i = 0
  for (const { policy, schedules } of catalogue) {
    // Terminated (surrendered OR matured) policies drop out of the total from their effective month.
    if (
      policy.termination_effective_date &&
      month >= startOfMonth(policy.termination_effective_date)
    )
      continue
    const r = resolvePolicyAtAge(schedules, age)
    if (!r) continue
    const original = originalCashValueAtAge(schedules, age)
    const variance = varianceAtAge(schedules, age)
    const pct = surrenderGainPctPerYear(r.cashValue, r.premium, r.policyYear)
    const rate =
      policy.currency === 'USD' ? rates.usd : policy.currency === 'CNY' ? rates.cny : 1
    out.push({
      asset_type: 'insurance',
      name: policy.policy_name || policy.policy_number,
      currency: policy.currency,
      details: {
        policy_id: policy.id,
        policy_number: policy.policy_number,
        provider: policy.provider,
        policy_year: String(r.policyYear),
        premium: String(r.premium),
        cash_value_original: original == null ? '' : String(original),
        variance: variance == null ? '' : String(variance),
        surrender_pct: pct.toFixed(2),
        as_of_year: r.isCarried ? String(r.asOfYear) : '',
      },
      value_native: r.cashValue,
      fx_rate_to_base: rate,
      value_base: r.cashValue * rate,
      sort_order: 10000 + i++,
    })
  }
  return out
}

/**
 * Manual CSV import that writes a **complete** month snapshot: the imported manual rows plus the
 * month's `fund` rows (kept if already frozen, else carried forward from the prior month) plus
 * `insurance` rows (kept if already frozen, else resolved from the catalogue and frozen now). So a
 * manual import no longer leaves insurance/funds out of the snapshot — the dashboard total is
 * complete without needing a separate Monthly Entry SAVE.
 */
export async function saveManualImportComplete(
  userId: string,
  month: string,
  manualRows: AssetEntryInput[],
  birthYear: number,
  rates: { usd: number; cny: number },
): Promise<void> {
  const existing = await getSnapshotWithEntries(userId, month)
  const entries = existing?.entries ?? []

  let fund = entries.filter((e) => e.asset_type === 'fund').map(entryToInput)
  if (fund.length === 0) {
    const prior = await getLatestSnapshotBefore(userId, month)
    if (prior) {
      fund = (await listEntriesBySnapshot(prior.id))
        .filter((e) => e.asset_type === 'fund')
        .map(entryToInput)
    }
  }

  let insurance = entries.filter((e) => e.asset_type === 'insurance').map(entryToInput)
  if (insurance.length === 0) {
    const catalogue = await listCatalogue(userId)
    insurance = buildResolvedInsuranceEntries(catalogue, month, birthYear, rates)
  }

  await saveSnapshotEntries(userId, month, [...manualRows, ...fund, ...insurance])
}

/**
 * Create-or-replace a month's entries: ensure the month's snapshot exists, delete its current
 * `asset_entry` rows, then insert the supplied set. **Idempotent per month** — re-running for a
 * month replaces its entries, never duplicating them. Reused by the CSV importer (M6).
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
