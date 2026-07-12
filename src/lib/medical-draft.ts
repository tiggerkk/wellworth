/**
 * Shared editable-draft model for a Medical report (parent + result rows), used by both the manual
 * Add/Edit form (`MedicalEntry`) and the import review screen (`ImportMedicalSheet`) so they share one
 * editor + one save mapping. Pure/UI-free. A `clientId` tags rows for React keys + in-place edits and
 * is dropped on save. Numbers are held as strings while editing (empty = unset).
 */
import {
  type MedicalCategory,
  type MedicalFlag,
  type ReportType,
} from '../constants/medical'
import {
  type MedicalReportInsert,
  type MedicalReportRow,
  type MedicalResultInput,
  type MedicalResultRow,
  usesBodyPart,
} from './medical'
import { todayLocal, type IsoDate } from './date'
import { numStr } from './quantity'
import type { ParsedReport } from './medical-import'

export interface ResultDraft {
  clientId: string
  test_key: string | null
  test_name: string
  category: MedicalCategory
  value_num: string
  value_text: string
  unit: string
  ref_text: string
  flag: '' | MedicalFlag
  uncertain: boolean
  // Carried through unchanged (set by the importer's unit normalization; manual rows leave these).
  ref_low: number | null
  ref_high: number | null
  normalized: boolean
  value_num_original: number | null
  unit_original: string | null
}

export interface ReportDraft {
  report_date: IsoDate
  report_type: ReportType
  body_part: string
  provider: string
  narrative: string
  document_urls: string[]
  results: ResultDraft[]
}

let seq = 0
export const nextClientId = (): string => `r${++seq}`

const numOrNull = (s: string): number | null => {
  const n = Number(s)
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

export function blankResultDraft(
  test_key: string | null,
  test_name: string,
  category: MedicalCategory,
  unit: string,
): ResultDraft {
  return {
    clientId: nextClientId(),
    test_key,
    test_name,
    category,
    value_num: '',
    value_text: '',
    unit,
    ref_text: '',
    flag: '',
    uncertain: false,
    ref_low: null,
    ref_high: null,
    normalized: false,
    value_num_original: null,
    unit_original: null,
  }
}

export function blankReportDraft(): ReportDraft {
  return {
    report_date: todayLocal(),
    report_type: 'health_screening',
    body_part: '',
    provider: '',
    narrative: '',
    document_urls: [],
    results: [],
  }
}

export function reportToDraft(
  report: MedicalReportRow,
  results: MedicalResultRow[],
): ReportDraft {
  return {
    report_date: report.report_date,
    report_type: report.report_type as ReportType,
    body_part: report.body_part ?? '',
    provider: report.provider ?? '',
    narrative: report.narrative ?? '',
    document_urls: report.document_urls ?? [],
    results: results.map((r) => ({
      clientId: nextClientId(),
      test_key: r.test_key,
      test_name: r.test_name,
      category: r.category as MedicalCategory,
      value_num: numStr(r.value_num),
      value_text: r.value_text ?? '',
      unit: r.unit ?? '',
      ref_text: r.ref_text ?? '',
      flag: (r.flag as MedicalFlag | null) ?? '',
      uncertain: r.uncertain,
      ref_low: r.ref_low,
      ref_high: r.ref_high,
      normalized: r.normalized,
      value_num_original: r.value_num_original,
      unit_original: r.unit_original,
    })),
  }
}

/** Build an editable draft from a freshly parsed import (Drive links are pasted on the review screen). */
export function parsedReportToDraft(p: ParsedReport): ReportDraft {
  return {
    report_date: p.report_date ?? todayLocal(),
    report_type: p.report_type,
    body_part: p.body_part ?? '',
    provider: p.provider ?? '',
    narrative: p.narrative ?? '',
    document_urls: [],
    results: p.results.map((r) => ({
      clientId: nextClientId(),
      test_key: r.test_key,
      test_name: r.test_name,
      category: r.category,
      value_num: numStr(r.value_num),
      value_text: r.value_text ?? '',
      unit: r.unit ?? '',
      ref_text: r.ref_text ?? '',
      flag: r.flag ?? '',
      uncertain: r.uncertain,
      ref_low: r.ref_low,
      ref_high: r.ref_high,
      normalized: r.normalized,
      value_num_original: r.value_num_original,
      unit_original: r.unit_original,
    })),
  }
}

/** Map a draft to the data layer's save shape (skips blank-named rows; trims report fields). */
export function draftToSaveInput(draft: ReportDraft): {
  parent: Omit<MedicalReportInsert, 'user_id'>
  results: MedicalResultInput[]
} {
  const parent: Omit<MedicalReportInsert, 'user_id'> = {
    report_date: draft.report_date,
    report_type: draft.report_type,
    body_part:
      usesBodyPart(draft.report_type) && draft.body_part.trim()
        ? draft.body_part.trim()
        : null,
    provider: draft.provider.trim() || null,
    narrative: draft.narrative.trim() || null,
    document_urls: draft.document_urls.map((u) => u.trim()).filter(Boolean),
  }
  const results: MedicalResultInput[] = draft.results
    .filter((r) => r.test_name.trim())
    .map((r) => ({
      test_key: r.test_key,
      test_name: r.test_name.trim(),
      category: r.category,
      value_num: numOrNull(r.value_num),
      value_text: r.value_text.trim() || null,
      unit: r.unit.trim() || null,
      ref_low: r.ref_low,
      ref_high: r.ref_high,
      ref_text: r.ref_text.trim() || null,
      flag: r.flag || null,
      uncertain: r.uncertain,
      normalized: r.normalized,
      value_num_original: r.value_num_original,
      unit_original: r.unit_original,
    }))
  return { parent, results }
}
