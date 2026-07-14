import { supabase } from '../lib/supabase'
import type {
  MedicalReportInsert,
  MedicalReportRow,
  MedicalReportUpdate,
  MedicalResultInput,
  MedicalResultRow,
} from '../lib/medical'

/**
 * Typed data-access for the Medical module (`medical_report` + its `medical_result` children).
 * Components never call Supabase directly — they go through here. RLS enforces `user_id = auth.uid()`
 * server-side. The `medical_lab_test` reference is NOT fetched at runtime — the static
 * `MEDICAL_LAB_TESTS` in `src/constants/medical.ts` (identical to the seeded rows) is the read-only source.
 */

/**
 * All of a user's reports, newest report-date first (Reports list order). Pass `limit` for a
 * bounded fetch (the Dashboard timeline only ever shows the 5 most recent + a "view all" nudge —
 * see `useMedicalTrends`); omit it for the full Reports list, which needs every row to search/filter.
 */
export async function listReports(
  userId: string,
  limit?: number,
): Promise<MedicalReportRow[]> {
  let query = supabase
    .from('medical_report')
    .select('*')
    .eq('user_id', userId)
    .order('report_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (limit != null) query = query.limit(limit)
  const { data, error } = await query
  if (error) throw error
  return data
}

export interface ReportWithResults {
  report: MedicalReportRow
  results: MedicalResultRow[]
}

/** A result row carrying its parent report's date + type — the Dashboard trend/latest-value unit. */
export interface ResultWithReportMeta extends MedicalResultRow {
  report_date: string
  report_type: string
}

/**
 * The most recent result **per test** (per user) with its report's date + type, from the
 * `medical_latest_result` **view** (DISTINCT ON per test, in the database). Powers the Dashboard's
 * latest-values-by-category card; the payload is O(distinct tests), NOT every historical result. The
 * view is `security_invoker`, so the base tables' RLS scopes rows; we still filter on `user_id` to
 * match the other queries. View columns are nullable (no NOT NULL on a view); the rows are real
 * `medical_result` rows, so the cast to the non-null `ResultWithReportMeta` is safe.
 */
export async function listLatestResultPerTest(
  userId: string,
): Promise<ResultWithReportMeta[]> {
  const { data, error } = await supabase
    .from('medical_latest_result')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []) as ResultWithReportMeta[]
}

/**
 * Result history for the given test keys (the Dashboard's tracked sparkline tests), each flattened
 * with its report's date + type. Filtered to `testKeys` so the sparkline fetch doesn't pull every
 * un-tracked test's full history. Returns [] for an empty key list (no tracked tests). RLS-scoped.
 */
export async function listTrackedResultSeries(
  userId: string,
  testKeys: string[],
): Promise<ResultWithReportMeta[]> {
  if (testKeys.length === 0) return []
  const { data, error } = await supabase
    .from('medical_result')
    .select('*, medical_report!inner(report_date, report_type)')
    .eq('user_id', userId)
    .in('test_key', testKeys)
  if (error) throw error
  return (data ?? []).map(({ medical_report, ...rest }) => ({
    ...rest,
    report_date: medical_report.report_date,
    report_type: medical_report.report_type,
  }))
}

/**
 * A report together with its result rows, or null if the id doesn't resolve (RLS-scoped). The two
 * queries are independent (the results query only needs `reportId`, not anything from the report
 * row), so they're fired together with `Promise.all` instead of one waiting on the other — this
 * halves the network latency on Report Detail / Edit Report, both of which load through here.
 */
export async function getReportWithResults(
  reportId: string,
): Promise<ReportWithResults | null> {
  const [reportRes, resultsRes] = await Promise.all([
    supabase.from('medical_report').select('*').eq('id', reportId).maybeSingle(),
    supabase
      .from('medical_result')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true }),
  ])
  if (reportRes.error) throw reportRes.error
  if (resultsRes.error) throw resultsRes.error
  if (!reportRes.data) return null

  return { report: reportRes.data, results: resultsRes.data ?? [] }
}

export async function createReport(
  input: MedicalReportInsert,
): Promise<MedicalReportRow> {
  const { data, error } = await supabase
    .from('medical_report')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateReport(
  id: string,
  patch: MedicalReportUpdate,
): Promise<void> {
  const { error } = await supabase.from('medical_report').update(patch).eq('id', id)
  if (error) throw error
}

/** Hard delete — the FK `on delete cascade` removes the report's `medical_result` rows. */
export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from('medical_report').delete().eq('id', id)
  if (error) throw error
}

/**
 * Create-or-replace a report's results: delete its current `medical_result` rows, then insert the
 * supplied set. **Idempotent per report** — re-saving replaces them, never duplicating. Follows
 * `asset-entry.saveSnapshotEntries` (the delete-then-insert is not transactional — the accepted
 * solo-app trade-off; a transactional RPC is a later nicety). Reused by the M3 importer.
 */
export async function saveReportResults(
  userId: string,
  reportId: string,
  rows: MedicalResultInput[],
): Promise<void> {
  const { error: delError } = await supabase
    .from('medical_result')
    .delete()
    .eq('report_id', reportId)
  if (delError) throw delError

  if (rows.length === 0) return
  const { error } = await supabase
    .from('medical_result')
    .insert(rows.map((r) => ({ ...r, report_id: reportId, user_id: userId })))
  if (error) throw error
}

export interface SaveReportInput {
  /** Parent fields (report_date, report_type, body_part, provider, narrative, document_urls). */
  parent: Omit<MedicalReportInsert, 'user_id'>
  results: MedicalResultInput[]
}

/**
 * Save a whole report (parent + children): create-or-update the parent, then create-or-replace its
 * results. Returns the report id. The Add/Edit Report form calls this on CREATE/SAVE.
 */
export async function saveReport(
  userId: string,
  input: SaveReportInput,
  id?: string,
): Promise<string> {
  let reportId: string
  if (id) {
    await updateReport(id, input.parent)
    reportId = id
  } else {
    const row = await createReport({ ...input.parent, user_id: userId })
    reportId = row.id
  }
  await saveReportResults(userId, reportId, input.results)
  return reportId
}

/** An existing report for the same date + type, if any (used to make import idempotent). */
export async function findReportByDateType(
  userId: string,
  reportDate: string,
  reportType: string,
): Promise<MedicalReportRow | null> {
  const { data, error } = await supabase
    .from('medical_report')
    .select('*')
    .eq('user_id', userId)
    .eq('report_date', reportDate)
    .eq('report_type', reportType)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Import a report idempotently: if one already exists for the same `report_date` + `report_type`, it
 * is **replaced** (parent updated, results create-or-replaced); otherwise a new report is created.
 * Re-importing the same file therefore never duplicates. Returns `{ id, replaced }`. A report with no
 * date can't be matched, so it always creates.
 */
export async function saveImportedReport(
  userId: string,
  input: SaveReportInput,
): Promise<{ id: string; replaced: boolean }> {
  const date = input.parent.report_date
  const existing = date
    ? await findReportByDateType(userId, date, input.parent.report_type)
    : null
  const id = await saveReport(userId, input, existing?.id)
  return { id, replaced: existing != null }
}
