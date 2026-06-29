/**
 * Presentational Policy detail body — resolved figures at a given age + the full resolved schedule.
 * Reused by the routed PolicyDetailSheet (Monthly Entry tap + dashboard drill-in). Amounts are in
 * the policy's own currency.
 */
import {
  breakEven,
  buildResolvedSeries,
  gainLossClass,
  originalCashValueAtAge,
  resolvePolicyAtAge,
  surrenderGainPctPerYear,
  varianceAtAge,
  type ScheduleVersion,
} from '../lib/networth'

export interface PolicyDetailData {
  provider: string
  policy_number: string
  policy_name: string
  currency: string
}

function money(currency: string, v: number | null): string {
  return v == null ? '—' : `${currency} ${Math.round(v).toLocaleString('en-US')}`
}

export function PolicyDetail({
  policy,
  schedules,
  age,
  providerLabel,
}: {
  policy: PolicyDetailData
  schedules: ScheduleVersion[]
  age: number
  /** Resolved provider label (from the configured list); falls back to the raw key. */
  providerLabel?: string
}) {
  const ccy = policy.currency
  const resolved = resolvePolicyAtAge(schedules, age)
  const original = originalCashValueAtAge(schedules, age)
  const variance = varianceAtAge(schedules, age)
  const be = breakEven(schedules)
  const series = buildResolvedSeries(schedules)
  const gain =
    resolved && resolved.policyYear > 0
      ? surrenderGainPctPerYear(resolved.cashValue, resolved.premium, resolved.policyYear)
      : null

  const metrics: { label: string; value: string; valueClass?: string }[] = [
    {
      label: `Policy Year (age ${age})`,
      value: resolved ? String(resolved.policyYear) : '—',
    },
    { label: 'Total Premium Paid', value: money(ccy, resolved?.premium ?? null) },
    {
      label:
        'Cash Value' + (resolved?.isCarried ? ` (as of yr ${resolved.asOfYear})` : ''),
      value: money(ccy, resolved?.cashValue ?? null),
    },
    { label: 'Original Cash Value', value: money(ccy, original) },
    {
      label: 'Variance (actual − original)',
      value: variance == null ? '—' : money(ccy, variance),
    },
    {
      label: 'Surrender Gain %/yr',
      value: gain == null ? '—' : `${gain.toFixed(2)}%`,
      valueClass: gain == null ? undefined : gainLossClass(gain),
    },
    {
      label: 'Break-even',
      value: be
        ? be.atOrBeforeFirst
          ? `≤ first tracked year (Age ${be.age})`
          : `Age ${be.age}`
        : 'not yet',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[15px] text-text-primary">{policy.policy_name}</p>
        <p className="text-xs text-text-secondary">
          {providerLabel ?? policy.provider} · {policy.policy_number} · {ccy}
        </p>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <span className="text-xs text-text-secondary">{m.label}</span>
            <span className={`text-[15px] ${m.valueClass ?? 'text-text-primary'}`}>
              {m.value}
            </span>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-text-secondary">
          Schedule
        </p>
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="grid grid-cols-5 gap-2 border-b border-border px-3 py-2 text-[11px] uppercase tracking-wide text-text-secondary">
            <span>Age</span>
            <span>Yr</span>
            <span className="text-right">Premium</span>
            <span className="text-right">Cash</span>
            <span className="text-right">Gain %/Yr</span>
          </div>
          {series.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-text-tertiary">
              No schedule yet.
            </p>
          ) : (
            series.map((p) => {
              const rowGain = surrenderGainPctPerYear(
                p.cashValue,
                p.premium,
                p.policyYear,
              )
              return (
                <div
                  key={p.age}
                  className="grid grid-cols-5 gap-2 border-b border-border px-3 py-1.5 text-[13px] text-text-primary last:border-b-0"
                >
                  <span>{p.age}</span>
                  <span className="text-text-secondary">{p.policyYear}</span>
                  <span className="text-right">
                    {Math.round(p.premium).toLocaleString('en-US')}
                  </span>
                  <span className="text-right">
                    {Math.round(p.cashValue).toLocaleString('en-US')}
                    {p.isCarried && <span className="ml-1 text-text-tertiary">·c</span>}
                  </span>
                  <span className={`text-right ${gainLossClass(rowGain)}`}>
                    {rowGain.toFixed(2)}%
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
