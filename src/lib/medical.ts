/**
 * Medical domain helpers — UI-framework-free so they're unit-tested and shared by Medical functions.
 * DB access lives in `src/data/medical.ts`; enums + labels live in `src/constants/medical.ts`;
 * MEDICAL_LAB_TESTS is the **source of truth** for the seed migration. The seed replicates this list
 * exactly; `medical.test.ts` cross-checks the two so they can't drift.
 */
import type { Tables, TablesInsert, TablesUpdate } from '../types/database'
import {
  MEDICAL_CATEGORIES,
  type MedicalCategory,
  MEDICAL_LAB_TESTS,
  type MedicalLabTestSeed,
} from '../constants/medical.ts'
import { foldZh } from './zh-fold'

// DB row/insert/update aliases — the data layer (`src/data/medical.ts`) imports these.
export type MedicalReportRow = Tables<'medical_report'>
export type MedicalReportInsert = TablesInsert<'medical_report'>
export type MedicalReportUpdate = TablesUpdate<'medical_report'>
export type MedicalResultRow = Tables<'medical_result'>
export type MedicalResultInsert = TablesInsert<'medical_result'>
export type MedicalResultUpdate = TablesUpdate<'medical_result'>
/** A result to persist; the save fills in `report_id` + `user_id`. */
export type MedicalResultInput = Omit<MedicalResultInsert, 'report_id' | 'user_id'>

/** A report only has a body part for these scan types. */
export function usesBodyPart(type: string): boolean {
  return (
    type === 'mri' || type === 'ultrasound' || type === 'mammogram' || type === 'other'
  )
}

// --- Reports-list view (search + filters + sort; pure — the screen holds the criteria state) ---

export type ReportSortField = 'date' | 'type' | 'provider' | 'bodyPart'
export type ReportSortDir = 'asc' | 'desc'

export interface ReportListCriteria {
  query: string
  reportType: 'all' | string
  provider: 'all' | string
  bodyPart: 'all' | string
  sortField: ReportSortField
  sortDir: ReportSortDir
}

export const DEFAULT_REPORT_LIST_CRITERIA: ReportListCriteria = {
  query: '',
  reportType: 'all',
  provider: 'all',
  bodyPart: 'all',
  sortField: 'date',
  sortDir: 'desc',
}

/** Sorted distinct providers across the reports (drives the Provider filter). */
export function reportProviders(reports: Pick<MedicalReportRow, 'provider'>[]): string[] {
  const set = new Set<string>()
  for (const r of reports) if (r.provider) set.add(r.provider)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Sorted distinct body parts across the reports (drives the Body Part filter). */
export function reportBodyParts(
  reports: Pick<MedicalReportRow, 'body_part'>[],
): string[] {
  const set = new Set<string>()
  for (const r of reports) if (r.body_part) set.add(r.body_part)
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Folded text the Reports search matches: body part + narrative (Traditional⇄Simplified agnostic). */
export function reportSearchText(
  report: Pick<MedicalReportRow, 'body_part' | 'narrative'>,
): string {
  return foldZh([report.body_part, report.narrative].filter(Boolean).join(' '))
}

function reportSortKey(report: MedicalReportRow, field: ReportSortField): string | null {
  switch (field) {
    case 'date':
      return report.report_date
    case 'type':
      return report.report_type
    case 'provider':
      return report.provider
    case 'bodyPart':
      return report.body_part
  }
}

function compareReports(
  a: MedicalReportRow,
  b: MedicalReportRow,
  field: ReportSortField,
  dir: ReportSortDir,
): number {
  const ka = reportSortKey(a, field)
  const kb = reportSortKey(b, field)
  // Newest report first as the secondary order (and when a key is missing).
  const byDate = b.report_date.localeCompare(a.report_date)
  if (ka == null && kb == null) return byDate
  if (ka == null) return 1
  if (kb == null) return -1
  const primary = ka.localeCompare(kb)
  if (primary !== 0) return dir === 'asc' ? primary : -primary
  return byDate
}

/** Filter then sort the Reports list. Pure — does not mutate `reports`. */
export function applyReportView(
  reports: MedicalReportRow[],
  c: ReportListCriteria,
): MedicalReportRow[] {
  const q = foldZh(c.query.trim())
  return reports
    .filter((r) => {
      if (q && !reportSearchText(r).includes(q)) return false
      if (c.reportType !== 'all' && r.report_type !== c.reportType) return false
      if (c.provider !== 'all' && r.provider !== c.provider) return false
      if (c.bodyPart !== 'all' && r.body_part !== c.bodyPart) return false
      return true
    })
    .sort((a, b) => compareReports(a, b, c.sortField, c.sortDir))
}

/** Keys flagged default_tracked — seeds a new profile's medical_tracked_tests. */
export function defaultTrackedTestKeys(): string[] {
  return MEDICAL_LAB_TESTS.filter((x) => x.default_tracked).map((x) => x.key)
}

/** Reference test by key (the static seed replica is the runtime reference — no DB round-trip). */
export const labTestByKey: Map<string, MedicalLabTestSeed> = new Map(
  MEDICAL_LAB_TESTS.map((t) => [t.key, t]),
)

// Computed once at module load — MEDICAL_LAB_TESTS is static, so re-filtering + re-sorting it on
// every call (the test picker calls this on every keystroke) would be pure waste. Frozen so callers
// can't mutate the shared cache.
const TESTS_BY_CATEGORY: { category: MedicalCategory; tests: MedicalLabTestSeed[] }[] =
  MEDICAL_CATEGORIES.map((category) => ({
    category,
    tests: Object.freeze(
      MEDICAL_LAB_TESTS.filter((t) => t.category === category).sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    ) as MedicalLabTestSeed[],
  })).filter((g) => g.tests.length > 0)

/** The reference tests grouped by category, in section + sort order (for the test picker). */
export function medicalTestsByCategory(): {
  category: MedicalCategory
  tests: MedicalLabTestSeed[]
}[] {
  return TESTS_BY_CATEGORY
}

const CATEGORY_INDEX = new Map<string, number>(MEDICAL_CATEGORIES.map((c, i) => [c, i]))

/**
 * Stable display order for a report's results: by category section order, then the test's seeded
 * `sort_order`; ad-hoc/unknown tests (`test_key` null or not in the reference) sort last within their
 * category, then by name. `sectionOrder`/`testOrder` are the profile overrides (M5) — when omitted,
 * the seeded order is used. Pure; does not mutate the input.
 */
export function orderResultsForDisplay<
  T extends { category: string; test_key: string | null; test_name: string },
>(results: T[], sectionOrder?: string[] | null, testOrder?: string[] | null): T[] {
  const catRank = sectionOrder?.length
    ? new Map(sectionOrder.map((c, i) => [c, i]))
    : CATEGORY_INDEX
  const testRank = testOrder?.length ? new Map(testOrder.map((k, i) => [k, i])) : null
  const LAST = Number.MAX_SAFE_INTEGER
  const catOf = (c: string) => catRank.get(c) ?? LAST
  const testOf = (r: T) => {
    if (testRank) return r.test_key ? (testRank.get(r.test_key) ?? LAST) : LAST
    const seed = r.test_key ? labTestByKey.get(r.test_key) : undefined
    return seed ? seed.sort_order : LAST
  }
  return [...results].sort(
    (a, b) =>
      catOf(a.category) - catOf(b.category) ||
      testOf(a) - testOf(b) ||
      a.test_name.localeCompare(b.test_name),
  )
}

/**
 * Why an imported result is flagged for review (the "uncertain" lifecycle). Derived from row state so
 * it works identically on a parsed/draft row and a saved DB row (no persisted reason). The importer
 * raises `uncertain` from the AI file flag OR an app-side rule (numeric test with no number read, or a
 * name that matched no reference test); this turns the flag into a short reason for the
 * `Review – <reason>` marker. Returns null when the row isn't flagged.
 */
export function medicalReviewReason(args: {
  uncertain: boolean
  testKey: string | null
  hasNumericValue: boolean
}): string | null {
  if (!args.uncertain) return null
  const numeric = args.testKey
    ? labTestByKey.get(args.testKey)?.value_kind === 'numeric'
    : false
  if (numeric && !args.hasNumericValue) return 'no numeric value'
  if (args.testKey == null) return 'unmatched test'
  return 'check value'
}

/** Optional Add/Edit-Report parent fields, gated by `profile.medical_visible_fields`. */
export const MEDICAL_VISIBLE_FIELDS: { key: string; label: string }[] = [
  { key: 'provider', label: 'Provider' },
  { key: 'body_part', label: 'Body Part' },
  { key: 'narrative', label: 'Narrative' },
  { key: 'document_urls', label: 'Document Links' },
]

/** NULL = all fields visible (default-on); an explicit array is the trimmed set. */
export function isMedicalFieldVisible(
  visibleFields: string[] | null | undefined,
  key: string,
): boolean {
  return visibleFields == null || visibleFields.includes(key)
}

/** A result's display value: the qualitative text if present, else the (normalized) number, else "—". */
export function formatResultValue(r: {
  value_text: string | null
  value_num: number | null
}): string {
  if (r.value_text != null && r.value_text.trim() !== '') return r.value_text
  if (r.value_num != null) return String(r.value_num)
  return '—'
}

/** A result's reference range for display: the printed text if present, else the numeric span. */
export function formatRefRange(r: {
  ref_text: string | null
  ref_low: number | null
  ref_high: number | null
}): string {
  if (r.ref_text != null && r.ref_text.trim() !== '') return r.ref_text
  if (r.ref_low != null && r.ref_high != null) return `${r.ref_low}–${r.ref_high}`
  if (r.ref_low != null) return `≥ ${r.ref_low}`
  if (r.ref_high != null) return `≤ ${r.ref_high}`
  return ''
}
