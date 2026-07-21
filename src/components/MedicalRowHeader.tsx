/**
 * Standardized 2-line medical report identity block — reused by the Medical Dashboard's
 * recent-reports timeline, the Reports library, and the Report detail header. Presentational
 * only; each caller supplies its own wrapping element.
 *
 * Line 1: Report date · Type label · Body part (body part only for types that use it)
 * Line 2: Provider (if present)
 */
import { REPORT_TYPE_LABELS, type ReportType } from '../constants/medical'
import { formatFullDate } from '../lib/date'
import { usesBodyPart, type MedicalReportRow } from '../lib/medical'

type MedicalRowHeaderProps = {
  report: Pick<MedicalReportRow, 'report_date' | 'report_type' | 'provider' | 'body_part'>
  /** `'row'` (default) for list/dashboard rows (`text-body`); `'header'` for the Report Detail
   * screen header (`text-title font-medium`, matching other Entry/Detail screen titles). */
  variant?: 'row' | 'header'
}

/** Presentational: renders the 2 lines only. Each caller wraps this in its own sizing element
 * (a `min-w-0 flex-1` span/div) so truncation is governed by the caller's layout, not this component. */
export function MedicalRowHeader({ report, variant = 'row' }: MedicalRowHeaderProps) {
  const typeLabel =
    REPORT_TYPE_LABELS[report.report_type as ReportType] ?? report.report_type
  const line1Class =
    variant === 'header'
      ? 'truncate text-title font-medium text-text-primary'
      : 'block truncate text-body text-text-primary'

  return (
    <>
      <span className={line1Class}>
        {formatFullDate(report.report_date)} - {typeLabel}
        {usesBodyPart(report.report_type) && report.body_part
          ? ` · ${report.body_part}`
          : ''}
      </span>
      {report.provider && (
        <span className="block truncate text-caption text-text-secondary">
          {report.provider}
        </span>
      )}
    </>
  )
}
