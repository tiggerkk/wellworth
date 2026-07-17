import { Suspense, useMemo, useState } from 'react'
import { OverlayTop } from './OverlayTop'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { lazyWithReload } from '../lib/lazy-with-reload'
import { SelectMenu } from './SelectMenu'
import { type NetWorthCurrency } from '../constants/networth'
import {
  buildScheduleComparisonRows,
  gainLossClass,
  sortSchedulesDesc,
  type ScheduleVersion,
} from '../lib/networth'
import { formatFullDate } from '../lib/date'
import { InsurancePolicyHeader } from './InsurancePolicyHeader'

// Lazy so recharts is fetched only when the overlay actually renders (own chunk).
const InsuranceCompareCharts = lazyWithReload(() =>
  import('./InsuranceCompareCharts').then((m) => ({ default: m.InsuranceCompareCharts })),
)

function versionLabel(v: ScheduleVersion): string {
  const prefix = v.kind === 'original' ? '(O)' : '(U)'
  return v.effective_date ? `${prefix} ${formatFullDate(v.effective_date)}` : prefix
}

/**
 * Compare Schedules — a local full-screen overlay over the Edit Insurance form (same pattern as
 * the single-policy import overlay: not a route, doesn't remount the form). Lets the owner pick
 * any 2 schedule versions of the policy and see CASH + GAIN %/YR side by side across every age
 * either schedule has a point for, plus the two stacked charts below. Everything stays in the
 * policy's own `currency` — never converted to HKD.
 */
export function InsuranceCompareOverlay({
  policyNumber,
  startDate,
  providerLabel,
  policyName,
  schedules,
  currency,
  initialAId,
  initialBId,
  onClose,
}: {
  /** Policy Number · Policy Original Start Date header shown above the schedule pickers. */
  policyNumber: string
  startDate: string | null
  providerLabel: string
  policyName: string
  schedules: ScheduleVersion[]
  currency: NetWorthCurrency
  initialAId: string
  initialBId: string
  onClose: () => void
}) {
  const [idA, setIdA] = useState(initialAId)
  const [idB, setIdB] = useState(initialBId)
  useEscapeKey(onClose)

  const versionA = schedules.find((v) => v.id === idA) ?? null
  const versionB = schedules.find((v) => v.id === idB) ?? null
  const labelA = versionA ? versionLabel(versionA) : 'Schedule 1'
  const labelB = versionB ? versionLabel(versionB) : 'Schedule 2'

  const rows = useMemo(
    () => (versionA && versionB ? buildScheduleComparisonRows(versionA, versionB) : []),
    [versionA, versionB],
  )

  const options = sortSchedulesDesc(schedules).map((v) => ({
    value: v.id,
    label: versionLabel(v),
  }))

  return (
    <OverlayTop onClose={onClose} label="Compare Schedules">
      <ScreenHeaderTitle onClose={onClose} title="Compare Schedules" />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <InsurancePolicyHeader
            policyNumber={policyNumber}
            startDate={startDate}
            providerLabel={providerLabel}
            policyName={policyName}
          />
        </div>

        <div className="flex items-center gap-2">
          <SelectMenu
            value={idA}
            options={options}
            onChange={setIdA}
            ariaLabel="Schedule 1"
            className="flex-1"
            size="field"
          />
          <SelectMenu
            value={idB}
            options={options}
            onChange={setIdB}
            ariaLabel="Schedule 2"
            className="flex-1"
            size="field"
          />
        </div>

        {idA === idB && (
          <p className="text-caption text-warning">
            Pick two different schedules to compare.
          </p>
        )}

        {versionA && versionB && (
          <>
            {/* Fixed 6-column layout; the table scrolls as one unit on narrow (iPhone) widths.
                `shrink-0` matters: this div sets overflow-x-auto, which per the CSS overflow spec
                forces its overflow-y to compute as `auto` too — and an `auto`-overflow box used as
                a flex child (our parent above is `flex flex-col`) gets an automatic min-height of 0,
                so without shrink-0 it gets squeezed short and grows its own inner scrollbar instead
                of the page just scrolling normally. */}
            <div className="shrink-0 overflow-x-auto rounded-card border border-border bg-surface">
              <div className="min-w-[360px]">
                <div className="grid grid-cols-[2.3rem_1.6rem_3.8rem_minmax(0,1fr)_3.8rem_minmax(0,1fr)] gap-2 border-b border-border px-3 py-2 text-section uppercase tracking-wide text-text-secondary">
                  <span>Age</span>
                  <span>Yr</span>
                  <span className="text-right">Cash 1</span>
                  <span className="text-right">Gain 1</span>
                  <span className="text-right">Cash 2</span>
                  <span className="text-right">Gain 2</span>
                </div>
                {rows.map((r) => (
                  <div
                    key={r.age}
                    className="grid grid-cols-[2.3rem_1.6rem_3.8rem_minmax(0,1fr)_3.8rem_minmax(0,1fr)] gap-2 border-b border-border px-3 py-1.5 text-label text-text-primary last:border-b-0"
                  >
                    <span>{r.age}</span>
                    <span className="text-text-secondary">{r.policy_year}</span>
                    <span className="text-right">
                      {r.cashA != null
                        ? Math.round(r.cashA).toLocaleString('en-US')
                        : '–'}
                    </span>
                    <span
                      className={`text-right ${r.gainA != null ? gainLossClass(r.gainA) : 'text-text-tertiary'}`}
                    >
                      {r.gainA != null ? `${r.gainA.toFixed(2)}%` : '–'}
                    </span>
                    <span className="text-right">
                      {r.cashB != null
                        ? Math.round(r.cashB).toLocaleString('en-US')
                        : '–'}
                    </span>
                    <span
                      className={`text-right ${r.gainB != null ? gainLossClass(r.gainB) : 'text-text-tertiary'}`}
                    >
                      {r.gainB != null ? `${r.gainB.toFixed(2)}%` : '–'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Suspense
              fallback={
                <p className="py-10 text-center text-body text-text-secondary">
                  Loading chart…
                </p>
              }
            >
              <InsuranceCompareCharts
                rows={rows}
                currency={currency}
                labelA={labelA}
                labelB={labelB}
              />
            </Suspense>
          </>
        )}
      </div>
    </OverlayTop>
  )
}
