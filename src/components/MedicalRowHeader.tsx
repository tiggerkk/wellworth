/**
 * Standardized 2-line medical report identity block — reused by both the Medical Dashboard's
 * recent-reports timeline and the Reports library. Presentational only; each caller supplies its
 * own wrapping element.
 *
 * Line 1: Report date
 * Line 2: Type label · Provider · Body part (whichever are present)
 */
import { REPORT_TYPE_LABELS, type ReportType } from '../constants/medical'
import { formatFullDate } from '../lib/date'
import type { MedicalReportRow } from '../lib/medical'

type MedicalRowHeaderProps = {
  report: Pick<MedicalReportRow, 'report_date' | 'report_type' | 'provider' | 'body_part'>
}

/** Presentational: renders the 2 lines only. Each caller wraps this in its own sizing element
 * (a `min-w-0 flex-1` span/div) so truncation is governed by the caller's layout, not this component. */
export function MedicalRowHeader({ report }: MedicalRowHeaderProps) {
  const typeLabel =
    REPORT_TYPE_LABELS[report.report_type as ReportType] ?? report.report_type
  const secondary = [typeLabel, report.provider, report.body_part]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <span className="block text-body text-text-primary">
        {formatFullDate(report.report_date)}
      </span>
      <span className="block truncate text-caption text-text-secondary">{secondary}</span>
    </>
  )
}
