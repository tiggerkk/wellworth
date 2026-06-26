import { Suspense, useCallback, useState } from 'react'
import { IconCalendarPlus, IconChevronDown } from '@tabler/icons-react'
import { lazyWithReload } from '../lib/lazy-with-reload'
import { EmptyState } from '../components/EmptyState'
import { routes } from '../constants/routes'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useNetWorthVersion } from '../lib/networth-refresh'
import { listSnapshotsWithEntries } from '../data/asset-entry'
import {
  ASSET_TYPES,
  ASSET_TYPE_COLORS,
  ASSET_TYPE_LABELS,
  formatHkd,
  totalBase,
  typeBreakdown,
  typeTotals,
  type AssetType,
} from '../lib/networth'
import { NETWORTH_RANGES, rangeCutoff } from '../constants/networth-ranges'
import { formatMonthLabel, startOfMonth, todayLocal } from '../lib/date'
import { SectionCard } from '../components/SectionCard'
import { SegmentedTabs } from '../components/SegmentedTabs'
import type { TrendRow } from '../components/NetWorthTrendChart'

// Lazy so recharts is fetched only when the dashboard renders (own chunk).
const NetWorthTrendChart = lazyWithReload(() =>
  import('../components/NetWorthTrendChart').then((m) => ({
    default: m.NetWorthTrendChart,
  })),
)

export function NetWorthDashboard() {
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useNetWorthVersion()
  const [mode, setMode] = useState<'total' | 'type'>('total')
  const [rangeKey, setRangeKey] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)

  const fn = useCallback(() => {
    void version // refetch after an entry SAVE (bumpNetWorth)
    if (!userId) return Promise.resolve([])
    return listSnapshotsWithEntries(userId)
  }, [userId, version])
  const { data: snapshots, loading, error } = useAsync(fn)

  const all = snapshots ?? []
  const latest = all[all.length - 1]
  const currentTotal = latest ? totalBase(latest.entries) : 0

  const range = NETWORTH_RANGES.find((r) => r.key === rangeKey) ?? NETWORTH_RANGES[0]!
  const cutoff = rangeCutoff(range.months, startOfMonth(todayLocal()))
  const windowed = cutoff ? all.filter((s) => s.month >= cutoff) : all

  const presentTypes: AssetType[] = ASSET_TYPES.filter((t) =>
    windowed.some((s) => typeTotals(s.entries)[t] !== 0),
  )
  const chartData: TrendRow[] =
    mode === 'total'
      ? windowed.map((s) => ({ month: s.month, total: totalBase(s.entries) }))
      : windowed.map((s) => ({ month: s.month, ...typeTotals(s.entries) }))

  const breakdown = latest
    ? typeBreakdown(latest.entries).filter((r) => r.total !== 0)
    : []

  return (
    <div className="pb-4">
      {loading && <p className="px-4 pt-6 pb-6 text-sm text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-4 pt-6 pb-6 text-sm text-danger">
          Couldn’t load your net worth.
        </p>
      )}

      {!loading && !error && all.length === 0 && (
        <EmptyState
          Icon={IconCalendarPlus}
          title="No entries yet"
          actionLabel="Monthly Entry"
          to={routes.networth.entry}
        />
      )}

      {!loading && !error && all.length > 0 && (
        <div className="flex flex-col gap-3 px-4 pt-3">
          {/* Current total */}
          <SectionCard>
            <div className="px-4 py-4">
              <span className="block text-[11px] uppercase tracking-wide text-text-secondary">
                Net worth · {latest ? formatMonthLabel(latest.month) : ''}
              </span>
              <span className="mt-0.5 block text-3xl font-semibold text-text-primary">
                {formatHkd(currentTotal)}
              </span>
            </div>
          </SectionCard>

          {/* Trend */}
          <SectionCard>
            <div className="flex items-center justify-between gap-2 px-3 pt-3">
              <div className="w-44">
                <SegmentedTabs
                  value={mode}
                  onChange={(v) => setMode(v as 'total' | 'type')}
                  options={[
                    { value: 'total', label: 'Total' },
                    { value: 'type', label: 'By Type' },
                  ]}
                />
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
                    <div className="absolute right-0 z-20 mt-1 w-28 overflow-hidden rounded-card border border-border bg-surface text-sm shadow-lg">
                      {NETWORTH_RANGES.map((r) => (
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
            </div>
            <div className="px-2 py-3">
              <Suspense
                fallback={
                  <p className="py-10 text-center text-sm text-text-secondary">
                    Loading chart…
                  </p>
                }
              >
                <NetWorthTrendChart
                  mode={mode}
                  data={chartData}
                  presentTypes={presentTypes}
                />
              </Suspense>
            </div>
          </SectionCard>

          {/* Per-type summary (latest month) */}
          {breakdown.length > 0 && (
            <SectionCard title="By asset type · latest month">
              {breakdown.map((row) => (
                <div
                  key={row.type}
                  className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: ASSET_TYPE_COLORS[row.type] }}
                  />
                  <span className="flex-1 text-[15px] text-text-primary">
                    {ASSET_TYPE_LABELS[row.type]}
                  </span>
                  <span className="text-[15px] text-text-primary">
                    {formatHkd(row.total)}
                  </span>
                  <span className="w-12 text-right text-xs text-text-secondary">
                    {Math.round(row.pct * 100)}%
                  </span>
                </div>
              ))}
            </SectionCard>
          )}
        </div>
      )}
    </div>
  )
}
