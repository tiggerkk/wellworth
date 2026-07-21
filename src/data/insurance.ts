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

/** How many of the owner's policies use a provider key — gates that provider's deletion. */
export async function countPoliciesByProvider(
  userId: string,
  key: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('insurance_policy')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('provider', key)
  if (error) throw error
  return count ?? 0
}

/** Bulk-move policies from one provider key to another before the source key is deleted. */
export async function reassignProvider(
  userId: string,
  fromKey: string,
  toKey: string,
): Promise<void> {
  const { error } = await supabase
    .from('insurance_policy')
    .update({ provider: toKey })
    .eq('user_id', userId)
    .eq('provider', fromKey)
  if (error) throw error
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

/** Minimal identity for a plan bucket — enough to render an expandable list in the UI. */
export interface BulkImportItem {
  policy_number: string
  policy_name: string
  provider: string
}

/** Read-only classification of a bulk CSV against the current DB state. No writes. */
export interface BulkImportPlan {
  /** Policy number not found in the DB — will create the policy + an Original schedule. */
  toCreate: BulkImportItem[]
  /** Policy exists; its CSV date isn't among its existing schedules — will add an update schedule. */
  toAddSchedule: BulkImportItem[]
  /** Policy exists and its CSV date already matches an existing schedule — left alone entirely. */
  untouched: BulkImportItem[]
}

type PolicyScheduleDatesRow = {
  id: string
  policy_number: string
  insurance_schedule: { effective_date: string | null }[] | null
}

/**
 * Shared classification step for both `planBulkImport` (preview) and `applyBulkImport` (write):
 * one query fetching the CSV's policy numbers + each existing policy's schedule effective_dates,
 * then bucketing every parsed policy into create / add-schedule / untouched.
 */
async function classifyBulkImport(
  userId: string,
  parsed: ParsedPolicy[],
): Promise<{ plan: BulkImportPlan; existingIdByNumber: Map<string, string> }> {
  const plan: BulkImportPlan = { toCreate: [], toAddSchedule: [], untouched: [] }
  const existingIdByNumber = new Map<string, string>()
  if (parsed.length === 0) return { plan, existingIdByNumber }

  const { data, error } = await supabase
    .from('insurance_policy')
    .select('id, policy_number, insurance_schedule(effective_date)')
    .eq('user_id', userId)
    .in(
      'policy_number',
      parsed.map((p) => p.policy_number),
    )
  if (error) throw error

  const datesByNumber = new Map<string, Set<string | null>>()
  for (const row of (data ?? []) as PolicyScheduleDatesRow[]) {
    existingIdByNumber.set(row.policy_number, row.id)
    datesByNumber.set(
      row.policy_number,
      new Set((row.insurance_schedule ?? []).map((s) => s.effective_date)),
    )
  }

  for (const p of parsed) {
    const item: BulkImportItem = {
      policy_number: p.policy_number,
      policy_name: p.policy_name,
      provider: p.provider,
    }
    if (!existingIdByNumber.has(p.policy_number)) {
      plan.toCreate.push(item)
    } else if (datesByNumber.get(p.policy_number)?.has(p.start_date)) {
      plan.untouched.push(item)
    } else {
      plan.toAddSchedule.push(item)
    }
  }
  return { plan, existingIdByNumber }
}

/** Read-only preview of what `applyBulkImport` would do for this CSV — no writes. */
export async function planBulkImport(
  userId: string,
  parsed: ParsedPolicy[],
): Promise<BulkImportPlan> {
  const { plan } = await classifyBulkImport(userId, parsed)
  return plan
}

/**
 * Apply a bulk CSV import, never deleting or replacing existing schedules:
 *  - Policy number not in the DB yet → create the policy (all fields) + an Original schedule.
 *  - Policy exists, CSV date isn't among its existing schedules → add a new `update` schedule
 *    (points only — policy-level fields are never touched on an existing policy).
 *  - Policy exists, CSV date already matches an existing schedule → left untouched, no write at
 *    all. (To force a re-import of that schedule, delete it manually first.)
 * Re-classifies against the DB at write time rather than trusting an earlier preview, in case the
 * DB changed between preview and this call. Batched per table (F16a).
 */
export async function applyBulkImport(
  userId: string,
  parsed: ParsedPolicy[],
): Promise<{ created: number; added: number; untouched: number }> {
  if (parsed.length === 0) return { created: 0, added: 0, untouched: 0 }

  const { plan, existingIdByNumber } = await classifyBulkImport(userId, parsed)
  const createNumbers = new Set(plan.toCreate.map((i) => i.policy_number))
  const addNumbers = new Set(plan.toAddSchedule.map((i) => i.policy_number))
  const toCreate = parsed.filter((p) => createNumbers.has(p.policy_number))
  const toAddSchedule = parsed.filter((p) => addNumbers.has(p.policy_number))

  if (toCreate.length > 0) {
    const { data: inserted, error: iErr } = await supabase
      .from('insurance_policy')
      .insert(
        toCreate.map((p) => ({
          user_id: userId,
          provider: p.provider,
          policy_number: p.policy_number,
          policy_name: p.policy_name,
          start_date: p.start_date,
          currency: p.currency,
          notes: p.notes,
          termination_kind: p.termination_kind,
          termination_date: p.termination_date,
          termination_effective_date: p.termination_effective_date,
          termination_proceeds: p.termination_proceeds,
        })),
      )
      .select('id, policy_number')
    if (iErr) throw iErr

    const createdIdByNumber = new Map(inserted!.map((r) => [r.policy_number, r.id]))

    const { data: schedules, error: sErr } = await supabase
      .from('insurance_schedule')
      .insert(
        toCreate.map((p) => ({
          policy_id: createdIdByNumber.get(p.policy_number)!,
          kind: 'original' as const,
          first_year: p.first_year,
          effective_date: p.start_date,
        })),
      )
      .select('id, policy_id')
    if (sErr) throw sErr

    const scheduleByPolicyId = new Map(schedules!.map((s) => [s.policy_id, s.id]))
    const pointRows = toCreate.flatMap((p) => {
      const scheduleId = scheduleByPolicyId.get(createdIdByNumber.get(p.policy_number)!)!
      return p.points.map((pt) => ({
        schedule_id: scheduleId,
        age: pt.age,
        policy_year: pt.policy_year,
        total_premium_paid: pt.total_premium_paid,
        cash_value: pt.cash_value,
      }))
    })
    // Chunk the points insert to stay well within statement limits.
    for (let i = 0; i < pointRows.length; i += 500) {
      const { error: pErr } = await supabase
        .from('insurance_schedule_point')
        .insert(pointRows.slice(i, i + 500))
      if (pErr) throw pErr
    }
  }

  if (toAddSchedule.length > 0) {
    const { data: addedSchedules, error: asErr } = await supabase
      .from('insurance_schedule')
      .insert(
        toAddSchedule.map((p) => ({
          policy_id: existingIdByNumber.get(p.policy_number)!,
          kind: 'update' as const,
          first_year: p.first_year,
          effective_date: p.start_date,
        })),
      )
      .select('id, policy_id')
    if (asErr) throw asErr

    // One block per policy per import (see insurance-import-guide.md), so policy_id is unique
    // within this batch — safe to key by it.
    const addedScheduleByPolicyId = new Map(
      addedSchedules!.map((s) => [s.policy_id, s.id]),
    )
    const addPointRows = toAddSchedule.flatMap((p) => {
      const scheduleId = addedScheduleByPolicyId.get(
        existingIdByNumber.get(p.policy_number)!,
      )!
      return p.points.map((pt) => ({
        schedule_id: scheduleId,
        age: pt.age,
        policy_year: pt.policy_year,
        total_premium_paid: pt.total_premium_paid,
        cash_value: pt.cash_value,
      }))
    })
    // Chunk the points insert to stay well within statement limits.
    for (let i = 0; i < addPointRows.length; i += 500) {
      const { error: apErr } = await supabase
        .from('insurance_schedule_point')
        .insert(addPointRows.slice(i, i + 500))
      if (apErr) throw apErr
    }
  }

  return {
    created: toCreate.length,
    added: toAddSchedule.length,
    untouched: plan.untouched.length,
  }
}
