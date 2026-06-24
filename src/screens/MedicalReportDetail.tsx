import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconChevronLeft, IconExternalLink, IconPencil } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { getReportWithResults, type ReportWithResults } from '../data/medical'
import { useMedicalVersion } from '../lib/medical-refresh'
import {
  formatRefRange,
  formatResultValue,
  MEDICAL_CATEGORY_LABELS,
  MEDICAL_FLAG_CLASS,
  MEDICAL_FLAG_LABELS,
  orderResultsForDisplay,
  REPORT_TYPE_LABELS,
  usesBodyPart,
  type MedicalCategory,
  type MedicalFlag,
  type MedicalResultRow,
  type ReportType,
} from '../lib/medical'
import { formatFullDate } from '../lib/date'
import { routes } from '../constants/routes'
import { PrimaryButton } from '../components/PrimaryButton'

/**
 * Medical Report detail — read-only view of a report's parent fields, Drive link(s), narrative, and
 * results rendered in the seeded category + sort order (grouped under category headers, filtered to
 * the tests this report contains). Edit → the Add/Edit Report form.
 */
export function MedicalReportDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const version = useMedicalVersion()

  const loadFn = useCallback((): Promise<ReportWithResults | null> => {
    if (!id) return Promise.resolve(null)
    void version
    return getReportWithResults(id)
  }, [id, version])
  const { data, loading, error } = useAsync(loadFn)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={() => navigate(routes.medical.reports)}
          aria-label="Back"
          className="-ml-1 p-1 text-text-secondary"
        >
          <IconChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          {data ? (
            <>
              <p className="truncate text-[17px] font-medium text-text-primary">
                {formatFullDate(data.report.report_date)} -{' '}
                {REPORT_TYPE_LABELS[data.report.report_type as ReportType] ??
                  data.report.report_type}
                {usesBodyPart(data.report.report_type) && data.report.body_part
                  ? ` · ${data.report.body_part}`
                  : ''}
              </p>
              {data.report.provider && (
                <p className="truncate text-xs text-text-secondary">
                  {data.report.provider}
                </p>
              )}
            </>
          ) : (
            <p className="truncate text-[17px] font-medium text-text-primary">Report</p>
          )}
        </div>
        {id && data && (
          <PrimaryButton
            size="sm"
            onClick={() => navigate(routes.medical.edit(id))}
            aria-label="Edit"
          >
            <IconPencil size={18} />
          </PrimaryButton>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-sm text-text-secondary">Loading…</p>}
        {(error || (!loading && !data)) && (
          <p className="text-sm text-danger">Couldn’t load this report.</p>
        )}
        {data && <Body data={data} />}
      </div>
    </div>
  )
}

function Body({ data }: { data: ReportWithResults }) {
  const { report, results } = data
  const { data: profile } = useProfile()
  const ordered = orderResultsForDisplay(
    results,
    profile?.medical_section_order,
    profile?.medical_test_order,
  )
  const groups = groupByCategory(ordered)

  return (
    <div className="flex flex-col gap-5">
      {report.document_urls.length > 0 && (
        <div className="flex flex-col gap-2">
          {report.document_urls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-accent"
            >
              <IconExternalLink size={16} /> Open original
              {report.document_urls.length > 1 ? ` ${i + 1}` : ''}
            </a>
          ))}
        </div>
      )}

      {report.narrative && (
        <div className="rounded-card border border-border bg-surface p-3">
          <h2 className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            Narrative
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
            {report.narrative}
          </p>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.category}>
          <h2 className="mb-1 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
            {MEDICAL_CATEGORY_LABELS[g.category]}
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {g.rows.map((r) => (
              <ResultRow key={r.id} r={r} />
            ))}
          </div>
        </div>
      ))}

      {results.length === 0 && (
        <p className="text-sm text-text-tertiary">This report has no result rows.</p>
      )}
    </div>
  )
}

function ResultRow({ r }: { r: MedicalResultRow }) {
  const flag = (r.flag as MedicalFlag | null) ?? null
  const ref = formatRefRange(r)
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-text-primary">{r.test_name}</p>
        {ref && <p className="text-xs text-text-tertiary">Ref: {ref}</p>}
        {r.normalized && r.value_num_original != null && (
          <p className="text-xs text-text-tertiary">
            normalized from {r.value_num_original}
            {r.unit_original ? ` ${r.unit_original}` : ''}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className={flag ? MEDICAL_FLAG_CLASS[flag] : 'text-text-primary'}>
          {formatResultValue(r)}
          {r.unit ? ` ${r.unit}` : ''}
        </p>
        {(flag || r.uncertain) && (
          <p className="text-[11px] text-text-tertiary">
            {flag ? MEDICAL_FLAG_LABELS[flag] : ''}
            {flag && r.uncertain ? ' · ' : ''}
            {r.uncertain ? 'uncertain' : ''}
          </p>
        )}
      </div>
    </div>
  )
}

function groupByCategory(
  rows: MedicalResultRow[],
): { category: MedicalCategory; rows: MedicalResultRow[] }[] {
  const groups: { category: MedicalCategory; rows: MedicalResultRow[] }[] = []
  for (const r of rows) {
    const category = r.category as MedicalCategory
    const last = groups[groups.length - 1]
    if (last && last.category === category) last.rows.push(r)
    else groups.push({ category, rows: [r] })
  }
  return groups
}
