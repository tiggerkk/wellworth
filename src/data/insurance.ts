/**
 * Data-access for the insurance policy catalogue (insurance_policy / insurance_schedule /
 * insurance_schedule_point). Wraps the supabase-js query builder; no SQL or Supabase access in
 * components. Schedule versions are returned as the `ScheduleVersion` shape consumed by the pure
 * resolution helpers in `lib/networth.ts`.
 */
import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'
import type { ScheduleVersion, SchedulePoint } from '../lib/networth'
import type { ParsedPolicy } from '../lib/insurance-import'

export type Policy = Tables<'insurance_policy'>

export interface PolicyWithSchedules {
  policy: Policy
  schedules: ScheduleVersion[]
}

function toVersion(
  s: Tables<'insurance_schedule'>,
  points: Tables<'insurance_schedule_point'>[],
): ScheduleVersion {
  return {
    id: s.id,
    kind: s.kind === 'original' ? 'original' : 'update',
    first_year: s.first_year,
    effective_date: s.effective_date,
    points: points
      .map((p) => ({
        age: p.age,
        policy_year: p.policy_year,
        total_premium_paid: Number(p.total_premium_paid),
        cash_value: Number(p.cash_value),
      }))
      .sort((a, b) => a.age - b.age),
  }
}

export async function listPolicies(userId: string): Promise<Policy[]> {
  const { data, error } = await supabase
    .from('insurance_policy')
    .select('*')
    .eq('user_id', userId)
    .order('provider', { ascending: true })
    .order('policy_number', { ascending: true })
  if (error) throw error
  return data
}

// Nested embed: pull each policy with its schedules + points in ONE round-trip (PostgREST resource
// embedding) instead of three sequential queries — a big latency win on the free tier.
const CATALOGUE_SELECT = '*, insurance_schedule(*, insurance_schedule_point(*))'

type PolicyRowWithNested = Policy & {
  insurance_schedule:
    | (Tables<'insurance_schedule'> & {
        insurance_schedule_point: Tables<'insurance_schedule_point'>[] | null
      })[]
    | null
}

function toCatalogueEntry(row: PolicyRowWithNested): PolicyWithSchedules {
  const { insurance_schedule, ...policy } = row
  return {
    policy: policy as Policy,
    schedules: (insurance_schedule ?? []).map((s) =>
      toVersion(s, s.insurance_schedule_point ?? []),
    ),
  }
}

/** Every policy with its schedule versions (+ points) — used by Monthly Entry + dashboards. */
export async function listCatalogue(userId: string): Promise<PolicyWithSchedules[]> {
  const { data, error } = await supabase
    .from('insurance_policy')
    .select(CATALOGUE_SELECT)
    .eq('user_id', userId)
    .order('provider', { ascending: true })
    .order('policy_number', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => toCatalogueEntry(row as PolicyRowWithNested))
}

export async function getPolicyWithSchedules(
  userId: string,
  policyId: string,
): Promise<PolicyWithSchedules | null> {
  const { data, error } = await supabase
    .from('insurance_policy')
    .select(CATALOGUE_SELECT)
    .eq('user_id', userId)
    .eq('id', policyId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return toCatalogueEntry(data as PolicyRowWithNested)
}

export async function createPolicy(
  userId: string,
  fields: Omit<TablesInsert<'insurance_policy'>, 'user_id'>,
): Promise<Policy> {
  const { data, error } = await supabase
    .from('insurance_policy')
    .insert({ ...fields, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function savePolicyFields(
  policyId: string,
  patch: TablesUpdate<'insurance_policy'>,
): Promise<Policy> {
  const { data, error } = await supabase
    .from('insurance_policy')
    .update(patch)
    .eq('id', policyId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePolicy(policyId: string): Promise<void> {
  const { error } = await supabase.from('insurance_policy').delete().eq('id', policyId)
  if (error) throw error
}

export async function setSurrender(
  policyId: string,
  s: { month: string; date: string; proceeds: number },
): Promise<Policy> {
  return savePolicyFields(policyId, {
    surrendered_from_month: s.month,
    surrender_date: s.date,
    surrender_proceeds: s.proceeds,
  })
}

export async function clearSurrender(policyId: string): Promise<Policy> {
  return savePolicyFields(policyId, {
    surrendered_from_month: null,
    surrender_date: null,
    surrender_proceeds: null,
  })
}

async function insertPoints(scheduleId: string, points: SchedulePoint[]): Promise<void> {
  if (points.length === 0) return
  const { error } = await supabase.from('insurance_schedule_point').insert(
    points.map((p) => ({
      schedule_id: scheduleId,
      age: p.age,
      policy_year: p.policy_year,
      total_premium_paid: p.total_premium_paid,
      cash_value: p.cash_value,
    })),
  )
  if (error) throw error
}

/** Add a new schedule version (+ its points) to a policy; returns the new schedule id. */
export async function addScheduleVersion(
  policyId: string,
  v: {
    kind: 'original' | 'update'
    first_year: number
    effective_date: string | null
    points: SchedulePoint[]
  },
): Promise<string> {
  const { data, error } = await supabase
    .from('insurance_schedule')
    .insert({
      policy_id: policyId,
      kind: v.kind,
      first_year: v.first_year,
      effective_date: v.effective_date,
    })
    .select()
    .single()
  if (error) throw error
  await insertPoints(data.id, v.points)
  return data.id
}

/** Replace an existing schedule version wholesale (delete its points, update fields, re-insert). */
export async function replaceScheduleVersion(
  scheduleId: string,
  v: { first_year: number; effective_date?: string | null; points: SchedulePoint[] },
): Promise<void> {
  const { error: delErr } = await supabase
    .from('insurance_schedule_point')
    .delete()
    .eq('schedule_id', scheduleId)
  if (delErr) throw delErr

  const patch: TablesUpdate<'insurance_schedule'> = { first_year: v.first_year }
  if (v.effective_date !== undefined) patch.effective_date = v.effective_date
  const { error: updErr } = await supabase
    .from('insurance_schedule')
    .update(patch)
    .eq('id', scheduleId)
  if (updErr) throw updErr

  await insertPoints(scheduleId, v.points)
}

/** Edit a schedule version's effective_date (typo fix). */
export async function updateScheduleEffectiveDate(
  scheduleId: string,
  effectiveDate: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('insurance_schedule')
    .update({ effective_date: effectiveDate })
    .eq('id', scheduleId)
  if (error) throw error
}

/**
 * Hard-delete a schedule version. If the deleted version was the Original and other versions
 * remain, the earliest-effective remaining version is promoted to `kind: 'original'` so the
 * variance baseline survives.
 */
export async function deleteSchedule(
  policyId: string,
  scheduleId: string,
): Promise<void> {
  const { error } = await supabase
    .from('insurance_schedule')
    .delete()
    .eq('id', scheduleId)
  if (error) throw error

  const { data: remaining, error: rErr } = await supabase
    .from('insurance_schedule')
    .select('id, kind, effective_date')
    .eq('policy_id', policyId)
  if (rErr) throw rErr
  if (!remaining || remaining.length === 0) return
  if (remaining.some((s) => s.kind === 'original')) return

  const earliest = remaining.reduce((best, s) =>
    (s.effective_date ?? '') < (best.effective_date ?? '') ? s : best,
  )
  const { error: pErr } = await supabase
    .from('insurance_schedule')
    .update({ kind: 'original' })
    .eq('id', earliest.id)
  if (pErr) throw pErr
}

/**
 * One-time BULK SEED: upsert each parsed policy (conflict on user_id+policy_number) and (re)seed
 * a single Original schedule with its points. Re-running replaces the seeded schedules, never
 * duplicates. Batched per table (F16a).
 */
export async function upsertBulkPolicies(
  userId: string,
  parsed: ParsedPolicy[],
): Promise<number> {
  if (parsed.length === 0) return 0

  const { data: upserted, error: uErr } = await supabase
    .from('insurance_policy')
    .upsert(
      parsed.map((p) => ({
        user_id: userId,
        provider: p.provider,
        policy_number: p.policy_number,
        policy_name: p.policy_name,
        start_date: p.start_date,
        currency: p.currency,
      })),
      { onConflict: 'user_id,policy_number' },
    )
    .select('id, policy_number')
  if (uErr) throw uErr

  const idByNumber = new Map(upserted!.map((r) => [r.policy_number, r.id]))
  const policyIds = [...idByNumber.values()]

  // Replace any existing schedules for these policies (the bulk seed owns the Original).
  const { error: delErr } = await supabase
    .from('insurance_schedule')
    .delete()
    .in('policy_id', policyIds)
  if (delErr) throw delErr

  const { data: schedules, error: sErr } = await supabase
    .from('insurance_schedule')
    .insert(
      parsed.map((p) => ({
        policy_id: idByNumber.get(p.policy_number)!,
        kind: 'original' as const,
        first_year: p.first_year,
        effective_date: p.start_date,
      })),
    )
    .select('id, policy_id')
  if (sErr) throw sErr

  const scheduleByPolicy = new Map(schedules!.map((s) => [s.policy_id, s.id]))
  const pointRows = parsed.flatMap((p) =>
    p.points.map((pt) => ({
      schedule_id: scheduleByPolicy.get(idByNumber.get(p.policy_number)!)!,
      age: pt.age,
      policy_year: pt.policy_year,
      total_premium_paid: pt.total_premium_paid,
      cash_value: pt.cash_value,
    })),
  )
  // Chunk the points insert to stay well within statement limits.
  for (let i = 0; i < pointRows.length; i += 500) {
    const { error: pErr } = await supabase
      .from('insurance_schedule_point')
      .insert(pointRows.slice(i, i + 500))
    if (pErr) throw pErr
  }

  return parsed.length
}
