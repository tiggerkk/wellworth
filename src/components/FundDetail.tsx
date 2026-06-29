/**
 * Presentational Fund detail body — the read-only fields from a fund holding's `details`. Reused by
 * the routed FundDetailSheet (dashboard drill-in) and the local fund modal in Monthly Entry.
 */
import { gainLossClass } from '../lib/networth'

export interface FundDetailData {
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

export function FundDetail({ data }: { data: FundDetailData }) {
  const d = data.details
  const ccy = str(d.currency) || 'HKD'
  const money = (v: unknown, currency: string) => {
    const x = n(v)
    return x == null ? '—' : `${currency} ${x.toLocaleString('en-US')}`
  }
  const returnRate = n(d.return_rate)
  const pnl = n(d.pnl)
  const rows: { label: string; value: string; valueClass?: string }[] = [
    { label: 'Total Value (HKD)', value: money(data.valueHkd, 'HKD') },
    {
      label: 'Units (Total Holdings)',
      value: n(d.units) == null ? '—' : n(d.units)!.toLocaleString('en-US'),
    },
    { label: 'Avg Unit Cost', value: money(d.avg_cost, ccy) },
    { label: 'NAV per Unit', value: money(d.nav, ccy) },
    // Stored as YYYY/MM/DD by the importer; show as YYYY-MM-DD.
    { label: 'Priced as of', value: str(d.nav_as_of).replaceAll('/', '-') || '—' },
    { label: 'Total Cost', value: money(d.total_cost, 'HKD') },
    {
      label: 'Return Rate',
      value: returnRate == null ? '—' : `${returnRate.toFixed(2)}%`,
      valueClass: returnRate == null ? undefined : gainLossClass(returnRate),
    },
    {
      label: 'Profit / Loss',
      value: money(d.pnl, 'HKD'),
      valueClass: pnl == null ? undefined : gainLossClass(pnl),
    },
    { label: 'Asset Class', value: str(d.asset_class) || '—' },
    { label: 'Currency', value: ccy },
  ]
  return (
    <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between gap-3 px-4 py-2.5"
        >
          <span className="text-xs text-text-secondary">{r.label}</span>
          <span className={`text-[15px] ${r.valueClass ?? 'text-text-primary'}`}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}
