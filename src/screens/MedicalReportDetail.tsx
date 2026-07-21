import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { IconExternalLink, IconPencil } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useProfile } from '../hooks/useProfile'
import { getReportWithResults, type ReportWithResults } from '../data/medical'
import { useMedicalVersion } from '../lib/medical-refresh'
import {
  MEDICAL_CATEGORY_COLOR,
  MEDICAL_CATEGORY_LABELS,
  MEDICAL_FLAG_LABELS,
  type MedicalFlag,
} from '../constants/medical'
import {
  formatRefRange,
  formatResultValue,
  medicalReviewReason,
  orderResultsForDisplay,
  type MedicalResultRow,
} from '../lib/medical'
import { groupResultsByCategory } from '../lib/medical-order'
import { routes } from '../constants/routes'
import { EntryLoader } from '../components/EntryLoader'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { PrimaryButton } from '../components/PrimaryButton'
import { MedicalValueRow } from '../components/MedicalValueRow'
import { MedicalRowHeader } from '../components/MedicalRowHeader'
import { Collapsible } from '../components/Collapsible'

/**
 * Medical Report detail — read-only view of a report's parent fields, Drive link(s), narrative, and
 * results rendered in the seeded category + sort order (grouped under category headers, filtered to
 * the tests this report contains). Edit → the Add/Edit Report form.
 */
export function MedicalReportDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const version = useMedicalVersion()
  // Drill-in detail closes back to wherever it was opened from (Reports list or Dashboard) — same
  useEscapeKey(() => navigate(-1))

  const loadFn = useCallback((): Promise<ReportWithResults | null> => {
    if (!id) return Promise.resolve(null)
    void version
    return getReportWithResults(id)
  }, [id, version])
  const { data, loading, error } = useAsync(loadFn)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeaderTitle
        icon="back"
        actions={
          id &&
          data && (
            <PrimaryButton
              size="sm"
              onClick={() => navigate(routes.medical.edit(id))}
              aria-label="Edit"
            >
              <IconPencil size={18} />
            </PrimaryButton>
          )
        }
      >
        <div className="min-w-0 flex-1">
          {data ? (
            <MedicalRowHeader report={data.report} variant="header" />
          ) : (
            <p className="truncate text-title font-medium text-text-primary">Report</p>
          )}
        </div>
      </ScreenHeaderTitle>

      <div className="flex-1 overflow-y-auto p-4">
        <EntryLoader
          loading={loading}
          error={error}
          data={data}
          errorText="Couldn’t load this report."
        >
          {(d) => <Body data={d} />}
        </EntryLoader>
      </div>
    </div>
  )
}

function Body({ data }: { data: ReportWithResults }) {
  const { report, results } = data
  const { data: profile } = useProfile()
  const sectionOrder = profile?.medical_section_order
  const testOrder = profile?.medical_test_order
  const groups = useMemo(() => {
    const ordered = orderResultsForDisplay(results, sectionOrder, testOrder)
    return groupResultsByCategory(ordered)
  }, [results, sectionOrder, testOrder])

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
              className="flex items-center gap-2 text-body text-accent"
            >
              <IconExternalLink size={16} /> Open original
              {report.document_urls.length > 1 ? ` ${i + 1}` : ''}
            </a>
          ))}
        </div>
      )}

      {report.narrative && (
        <div className="rounded-card border border-border bg-surface p-3">
          <h2 className="mb-1 text-section font-medium uppercase tracking-[0.08em] text-text-secondary">
            Narrative
          </h2>
          <p className="whitespace-pre-line text-body leading-relaxed text-text-primary">
            {report.narrative}
          </p>
        </div>
      )}

      {groups.map((g) => (
        <Collapsible
          key={g.category}
          title={MEDICAL_CATEGORY_LABELS[g.category]}
          color={MEDICAL_CATEGORY_COLOR[g.category]}
          titleCase="caption"
          defaultOpen
        >
          <div className="divide-y divide-border">
            {g.rows.map((r) => (
              <ResultRow key={r.id} r={r} />
            ))}
          </div>
        </Collapsible>
      ))}

      {results.length === 0 && (
        <p className="text-body text-text-tertiary">This report has no result rows.</p>
      )}
    </div>
  )
}

function ResultRow({ r }: { r: MedicalResultRow }) {
  const flag = (r.flag as MedicalFlag | null) ?? null
  const ref = formatRefRange(r)
  // "uncertain" rows imported without review show the same `Review – <reason>` marker as the editor,
  // so an unresolved value is visible before tapping Edit (no Mark Reviewed button — this is read-only).
  const reviewReason = medicalReviewReason({
    uncertain: r.uncertain,
    testKey: r.test_key,
    hasNumericValue: r.value_num != null,
  })
  return (
    <MedicalValueRow
      name={r.test_name}
      refRange={ref}
      value={`${formatResultValue(r)}${r.unit ? ` ${r.unit}` : ''}`}
      flag={flag}
      className={`px-3 py-2.5 ${reviewReason ? 'bg-accent/10' : ''}`}
      leftExtra={
        <>
          {r.normalized && r.value_num_original != null && (
            <p className="text-caption text-text-tertiary">
              normalized from {r.value_num_original}
              {r.unit_original ? ` ${r.unit_original}` : ''}
            </p>
          )}
          {reviewReason && (
            <p className="text-label font-medium text-warning">Review – {reviewReason}</p>
          )}
        </>
      }
      rightExtra={
        flag && (
          <p className="text-section text-text-tertiary">{MEDICAL_FLAG_LABELS[flag]}</p>
        )
      }
    />
  )
}
