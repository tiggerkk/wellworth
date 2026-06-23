import { Suspense, useState } from 'react'
import { Link } from 'react-router'
import { IconChevronDown, IconChevronRight, IconX } from '@tabler/icons-react'
import { lazyWithReload } from '../lib/lazy-with-reload'
import { useMedicalTrends } from '../hooks/useMedicalTrends'
import { Sparkline } from '../components/Sparkline'
import { SectionCard } from '../components/SectionCard'
import { MEDICAL_RANGES, medicalRangeCutoff } from '../constants/medical-ranges'
import { asFlag, latestPoint, type TrackedTrend } from '../lib/medical-trends'
import {
  formatRefRange,
  formatResultValue,
  MEDICAL_CATEGORY_LABELS,
  MEDICAL_FLAG_COLOR,
  MEDICAL_FLAG_CLASS,
  REPORT_TYPE_LABELS,
  type MedicalReportRow,
  type ReportType,
} from '../lib/medical'
import type { ResultWithReportMeta } from '../data/medical'
import { formatFullDate, todayLocal } from '../lib/date'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { routes } from '../constants/routes'

// Lazy so recharts is fetched only when a sparkline is expanded (its own chunk). The grid itself
// draws cheap inline-SVG sparklines and never pulls in recharts.
const MedicalTrendChart = lazyWithReload(() =>
  import('../components/MedicalTrendChart').then((m) => ({
    default: m.MedicalTrendChart,
  })),
)

/**
 * Medical Dashboard (module index): a grid of inline-SVG trend sparklines for the tracked tests
 * (tap → full recharts chart), latest values per test grouped by category (flag-coloured), and a
 * recent-reports timeline. All data comes from `useMedicalTrends` (the data/presentation seam), so
 * an alternate trend layout could swap in here without touching the data layer.
 */
export function MedicalDashboard() {
  const { loading, error, tracked, latestByCategory, recentReports, isEmpty } =
    useMedicalTrends()
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const expanded = expandedKey ? tracked.find((t) => t.key === expandedKey) : undefined
  const expandedLatest = expandedKey
    ? latestByCategory.flatMap((g) => g.rows).find((r) => r.test_key === expandedKey)
    : undefined

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-10 bg-bg/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-medium text-text-primary">Medical</h1>
      </header>

      {loading && <p className="px-4 py-6 text-sm text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-4 py-6 text-sm text-danger">Couldn’t load your medical data.</p>
      )}

      {isEmpty && (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-text-secondary">
            No data yet — add a report to see trends and latest results.
          </p>
          <Link
            to={routes.medical.entry}
            className="mt-3 inline-block text-sm font-medium text-accent"
          >
            New Medical report
          </Link>
        </div>
      )}

      {!loading && !error && !isEmpty && (
        <div className="flex flex-col gap-5 px-4">
          {/* Trends — sparkline grid */}
          {tracked.length > 0 && (
            <section>
              <h2 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
                Trends
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {tracked.map((t) => (
                  <SparkCard key={t.key} trend={t} onOpen={() => setExpandedKey(t.key)} />
                ))}
              </div>
            </section>
          )}

          {/* Latest values per test, grouped by category */}
          {latestByCategory.map((group) => (
            <SectionCard
              key={group.category}
              title={MEDICAL_CATEGORY_LABELS[group.category]}
            >
              {group.rows.map((row) => (
                <LatestRow key={row.id} row={row} />
              ))}
            </SectionCard>
          ))}

          {/* Recent reports timeline */}
          <ReportsTimeline reports={recentReports} />
        </div>
      )}

      {expanded && (
        <ExpandedTrend
          trend={expanded}
          refLow={expandedLatest?.ref_low ?? null}
          refHigh={expandedLatest?.ref_high ?? null}
          onClose={() => setExpandedKey(null)}
        />
      )}
    </div>
  )
}

/** A tracked-test card: name, latest value (flag-coloured), and an inline sparkline. */
function SparkCard({ trend, onOpen }: { trend: TrackedTrend; onOpen: () => void }) {
  const last = latestPoint(trend.points)! // tracked guarantees ≥1 point
  const dotColor = last.flag ? MEDICAL_FLAG_COLOR[last.flag] : 'var(--color-accent)'
  return (
    <button
      onClick={onOpen}
      className="flex flex-col gap-0.5 rounded-card border border-border bg-surface p-3 text-left active:bg-input/40"
    >
      <span className="truncate text-[13px] text-text-secondary">{trend.name}</span>
      <span
        className={`text-lg font-semibold ${last.flag ? MEDICAL_FLAG_CLASS[last.flag] : 'text-text-primary'}`}
      >
        {last.value}
        {trend.unit && (
          <span className="ml-1 text-xs font-normal text-text-secondary">
            {trend.unit}
          </span>
        )}
      </span>
      <Sparkline
        values={trend.points.map((p) => p.value)}
        endColor={dotColor}
        width={128}
        height={32}
        className="mt-1"
      />
    </button>
  )
}

/** A latest-value row in the by-category list: test name · value (flag-coloured) · printed range. */
function LatestRow({ row }: { row: ResultWithReportMeta }) {
  const flag = asFlag(row.flag)
  const ref = formatRefRange(row)
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-[15px] text-text-primary">
        {row.test_name}
      </span>
      <div className="shrink-0 text-right">
        <div
          className={`text-[15px] ${flag ? MEDICAL_FLAG_CLASS[flag] : 'text-text-primary'}`}
        >
          {formatResultValue(row)}
          {row.unit ? ` ${row.unit}` : ''}
        </div>
        {ref && <div className="text-[11px] text-text-tertiary">Ref {ref}</div>}
      </div>
    </div>
  )
}

/** Up to five most-recent reports, linking to their detail; a "View all" row when there are more. */
function ReportsTimeline({ reports }: { reports: MedicalReportRow[] }) {
  if (reports.length === 0) return null
  const recent = reports.slice(0, 5)
  return (
    <SectionCard title="Recent reports">
      {recent.map((rep) => {
        const typeLabel =
          REPORT_TYPE_LABELS[rep.report_type as ReportType] ?? rep.report_type
        const secondary = [typeLabel, rep.provider, rep.body_part]
          .filter(Boolean)
          .join(' · ')
        return (
          <Link
            key={rep.id}
            to={routes.medical.detail(rep.id)}
            className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 active:bg-input/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] text-text-primary">
                {formatFullDate(rep.report_date)}
              </p>
              <p className="truncate text-xs text-text-secondary">{secondary}</p>
            </div>
            <IconChevronRight size={18} className="shrink-0 text-text-tertiary" />
          </Link>
        )
      })}
      {reports.length > recent.length && (
        <Link
          to={routes.medical.reports}
          className="block px-4 py-3 text-[15px] text-accent active:bg-input/40"
        >
          View all reports
        </Link>
      )}
    </SectionCard>
  )
}

/** Bottom-sheet overlay: the full recharts trend for one test + a time-window selector. */
function ExpandedTrend({
  trend,
  refLow,
  refHigh,
  onClose,
}: {
  trend: TrackedTrend
  refLow: number | null
  refHigh: number | null
  onClose: () => void
}) {
  const [rangeKey, setRangeKey] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  useEscapeKey(onClose)

  const range =
    MEDICAL_RANGES.find((r) => r.key === rangeKey) ??
    MEDICAL_RANGES[MEDICAL_RANGES.length - 1]!
  const cutoff = medicalRangeCutoff(range.months, todayLocal())
  const points = (
    cutoff ? trend.points.filter((p) => p.date >= cutoff) : trend.points
  ).map((p) => ({ date: p.date, value: p.value, flag: p.flag }))

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${trend.name} trend`}
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-text-primary">
              {trend.name}
            </p>
            {trend.unit && <p className="text-xs text-text-secondary">{trend.unit}</p>}
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-1 rounded-input bg-input px-2.5 py-1.5 text-sm text-text-primary"
            >
              {range.label}
              <IconChevronDown size={15} className="text-text-secondary" />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 z-20 mt-1 w-24 overflow-hidden rounded-card border border-border bg-surface text-sm shadow-lg">
                  {MEDICAL_RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => {
                        setRangeKey(r.key)
                        setMenuOpen(false)
                      }}
                      className={`block w-full px-4 py-2 text-left active:bg-input/40 ${
                        r.key === rangeKey ? 'text-accent' : 'text-text-primary'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0">
            <IconX size={22} className="text-text-secondary" />
          </button>
        </div>

        <div className="px-2 py-4">
          {points.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-secondary">
              No readings in this window.
            </p>
          ) : (
            <Suspense
              fallback={
                <p className="py-10 text-center text-sm text-text-secondary">
                  Loading chart…
                </p>
              }
            >
              <MedicalTrendChart
                points={points}
                unit={trend.unit}
                refLow={refLow}
                refHigh={refHigh}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  )
}
