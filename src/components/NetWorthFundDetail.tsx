/**
 * Presentational Fund detail body — the read-only fields from a fund holding's `details`. Reused by
 * the routed NetWorthFundDetailSheet (dashboard drill-in) and the local fund modal in Monthly Entry.
 */
import { ASSET_TYPE_COLORS } from '../constants/networth'
import { formatHkd, gainLossClass } from '../lib/networth'
import { formatFullDate } from '../lib/date'

export interface NetWorthFundDetailData {
  name: string
  /** Net-worth value in HKD (Total Value from the export). */
  valueHkd: number
  details: Record<string, unknown>
}

function n(v: unknown): number | null {
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
function str(v: unknown): string {
  return v == null ? '' : String(v)
}

export function NetWorthFundDetail({ data }: { data: NetWorthFundDetailData }) {
  const d = data.details
  const ccy = str(d.currency) || 'HKD'
  // HKD amounts read `HK$1,234` (matching the Dashboard / Monthly Entry via `formatHkd`); a non-HKD
  // base currency (USD/CNY unit cost + NAV) keeps its code prefix and its decimal precision.
  const hkd = (v: unknown) => {
    const x = n(v)
    return x == null ? '—' : formatHkd(x)
  }
  const money = (v: unknown, currency: string) => {
    const x = n(v)
    if (x == null) return '—'
    return currency === 'HKD'
      ? `HK$${x.toLocaleString('en-US')}`
      : `${currency} ${x.toLocaleString('en-US')}`
  }
  const returnRate = n(d.return_rate)
  const pnl = n(d.pnl)
  // Importer stores the priced-as-of date as YYYY/MM/DD; show it via the global `formatFullDate`
  // (e.g. `Jun 25, 2026`), the same MMM DD, YYYY format used for Medical reports.
  const navAsOf = str(d.nav_as_of).trim()
  const rows: { label: string; value: string; valueClass?: string }[] = [
    { label: 'Total Value (HKD)', value: hkd(data.valueHkd) },
    {
      label: 'Units (Total Holdings)',
      value: n(d.units) == null ? '—' : n(d.units)!.toLocaleString('en-US'),
    },
    { label: 'Avg Unit Cost', value: money(d.avg_cost, ccy) },
    { label: 'NAV per Unit', value: money(d.nav, ccy) },
    {
      label: 'Priced as of',
      value: navAsOf ? formatFullDate(navAsOf.replaceAll('/', '-')) : '—',
    },
    { label: 'Total Cost', value: hkd(d.total_cost) },
    {
      label: 'Return Rate',
      value: returnRate == null ? '—' : `${returnRate.toFixed(2)}%`,
      valueClass: returnRate == null ? undefined : gainLossClass(returnRate),
    },
    {
      label: 'Profit / Loss',
      value: hkd(d.pnl),
      valueClass: pnl == null ? undefined : gainLossClass(pnl),
    },
    { label: 'Asset Class', value: str(d.asset_class) || '—' },
    { label: 'Currency', value: ccy },
  ]
  return (
    <div
      className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface"
      style={{ borderLeft: `4px solid ${ASSET_TYPE_COLORS.fund}` }}
    >
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between gap-3 px-4 py-2.5"
        >
          <span className="text-caption text-text-secondary">{r.label}</span>
          <span className={`text-body ${r.valueClass ?? 'text-text-primary'}`}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}
