import { Suspense, useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconCalendarPlus, IconChevronDown } from '@tabler/icons-react'
import { lazyWithReload } from '../lib/lazy-with-reload'
import { EmptyState } from '../components/EmptyState'
import { routes } from '../constants/routes'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useNetWorthVersion } from '../lib/networth-refresh'
import { listMonthlyTypeTotals, listEntriesBySnapshot } from '../data/asset-entry'
import { listSnapshots } from '../data/networth-snapshot'
import { listCatalogue, type PolicyWithSchedules } from '../data/insurance'
import { fetchRatesToHkd } from '../lib/fx'
import {
  ageForYear,
  ASSET_TYPES,
  ASSET_TYPE_COLORS,
  ASSET_TYPE_LABELS,
  DEFAULT_BIRTH_YEAR,
  foldMonthlyTotals,
  formatHkd,
  gainLossClass,
  hasBrokenEven,
  resolvePolicyAtAge,
  sumTotals,
  typeBreakdownFromTotals,
  type AssetType,
} from '../lib/networth'
import {
  NETWORTH_RANGES,
  NETWORTH_RANGE_DEFAULT,
  rangeCutoff,
} from '../constants/networth-ranges'
import { formatMonthLabel, startOfMonth, todayLocal } from '../lib/date'
import { SectionCard } from '../components/SectionCard'
import { SegmentedTabs } from '../components/SegmentedTabs'
import type { TrendRow } from '../components/NetWorthTrendChart'
import type { InsuranceAggPoint } from '../components/InsuranceTrendChart'

// Lazy so recharts is fetched only when the dashboard renders (own chunk).
const NetWorthTrendChart = lazyWithReload(() =>
  import('../components/NetWorthTrendChart').then((m) => ({
    default: m.NetWorthTrendChart,
  })),
)
const InsuranceTrendChart = lazyWithReload(() =>
  import('../components/InsuranceTrendChart').then((m) => ({
    default: m.InsuranceTrendChart,
  })),
)

interface FundPerfRow {
  id: string
  name: string
  valueHkd: number
  returnRate: number | null
  pnl: number | null
}

interface InsuranceAgg {
  series: InsuranceAggPoint[]
  breakEvenAge: number | null
  currentCash: number
  currentPremium: number
  pastBreakEven: number
  activeCount: number
}

/** Build the aggregate Cash Value vs Total Premiums series (HKD) by age, across all policies. */
function buildInsuranceAgg(
  catalogue: PolicyWithSchedules[],
  rates: { usd: number; cny: number },
  currentAge: number,
): InsuranceAgg {
  const rateFor = (ccy: string) =>
    ccy === 'USD' ? rates.usd : ccy === 'CNY' ? rates.cny : 1
  const ages = new Set<number>()
  for (const { schedules } of catalogue)
    for (const s of schedules) for (const p of s.points) ages.add(p.age)
  const series: InsuranceAggPoint[] = [...ages]
    .sort((a, b) => a - b)
    .map((age) => {
      let cash = 0
      let premium = 0
      for (const { policy, schedules } of catalogue) {
        const r = resolvePolicyAtAge(schedules, age)
        if (!r) continue
        const rate = rateFor(policy.currency)
        cash += r.cashValue * rate
        premium += r.premium * rate
      }
      return { age, cash, premium }
    })
  const beIdx = series.findIndex((p) => p.cash >= p.premium)
  let currentCash = 0
  let currentPremium = 0
  let activeCount = 0
  for (const { policy, schedules } of catalogue) {
    const r = resolvePolicyAtAge(schedules, currentAge)
    if (!r) continue
    activeCount += 1
    const rate = rateFor(policy.currency)
    currentCash += r.cashValue * rate
    currentPremium += r.premium * rate
  }
  const pastBreakEven = catalogue.filter((c) =>
    hasBrokenEven(c.schedules, currentAge),
  ).length
  return {
    series,
    breakEvenAge: beIdx === -1 ? null : series[beIdx]!.age,
    currentCash,
    currentPremium,
    pastBreakEven,
    activeCount,
  }
}

export function NetWorthDashboard() {
  const { session } = useAuth()
  const userId = session?.user.id
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const version = useNetWorthVersion()
  const [mode, setMode] = useState<'total' | 'type'>('total')
  const [rangeKey, setRangeKey] = useState(NETWORTH_RANGE_DEFAULT)
  const [menuOpen, setMenuOpen] = useState(false)

  const fn = useCallback(() => {
    void version // refetch after an entry SAVE (bumpNetWorth)
    if (!userId) return Promise.resolve([])
    return listMonthlyTypeTotals(userId)
  }, [userId, version])
  const { data: rows, loading, error } = useAsync(fn)

  // Secondary load: latest funds (return %/P&L) + insurance catalogue + USD rate (for HKD agg).
  const extraFn = useCallback(async () => {
    void version
    if (!userId) return null
    const snaps = await listSnapshots(userId)
    const latestSnap = snaps[snaps.length - 1] ?? null
    const funds: FundPerfRow[] = latestSnap
      ? (await listEntriesBySnapshot(latestSnap.id))
          .filter((e) => e.asset_type === 'fund')
          .map((e) => {
            const d = (e.details ?? {}) as Record<string, unknown>
            const rr = Number(d.return_rate)
            const pl = Number(d.pnl)
            return {
              id: e.id,
              name: e.name,
              valueHkd: Number(e.value_base),
              returnRate: Number.isFinite(rr) ? rr : null,
              pnl: Number.isFinite(pl) ? pl : null,
            }
          })
          .sort((a, b) => b.valueHkd - a.valueHkd)
      : []
    const catalogue = await listCatalogue(userId)
    const fx = latestSnap ? await fetchRatesToHkd(latestSnap.month) : null
    const rates = { usd: fx?.USD ?? 1, cny: fx?.CNY ?? 1 }
    return { funds, catalogue, rates }
  }, [userId, version])
  const { data: extra } = useAsync(extraFn)

  // Fold the flat per-(month, type) view rows into one totals record per month (oldest first).
  const all = foldMonthlyTotals(rows ?? [])
  const latest = all[all.length - 1]
  const currentTotal = latest ? sumTotals(latest.totals) : 0

  const range = NETWORTH_RANGES.find((r) => r.key === rangeKey) ?? NETWORTH_RANGES[0]!
  const cutoff = rangeCutoff(range.months, startOfMonth(todayLocal()))
  const windowed = cutoff ? all.filter((s) => s.month >= cutoff) : all

  const presentTypes: AssetType[] = ASSET_TYPES.filter((t) =>
    windowed.some((s) => s.totals[t] !== 0),
  )
  const chartData: TrendRow[] =
    mode === 'total'
      ? windowed.map((s) => ({ month: s.month, total: sumTotals(s.totals) }))
      : windowed.map((s) => ({ month: s.month, ...s.totals }))

  const breakdown = latest
    ? typeBreakdownFromTotals(latest.totals).filter((r) => r.total !== 0)
    : []

  const birthYear = profile?.birthday
    ? Number(profile.birthday.slice(0, 4))
    : DEFAULT_BIRTH_YEAR
  const currentAge = ageForYear(Number(startOfMonth(todayLocal()).slice(0, 4)), birthYear)
  const funds = extra?.funds ?? []
  const agg =
    extra && extra.catalogue.length > 0
      ? buildInsuranceAgg(extra.catalogue, extra.rates, currentAge)
      : null

  return (
    <div className="flex min-h-full flex-col pb-4">
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

          {/* Fund Performance (latest month) */}
          {funds.length > 0 && (
            <SectionCard title="Fund performance · latest month">
              {funds.map((f) => (
                <button
                  key={f.id}
                  onClick={() => navigate(routes.networth.fund(f.id))}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left last:border-b-0 active:bg-input/40"
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] text-text-primary">
                    {f.name}
                  </span>
                  <span className="shrink-0 text-sm text-text-primary">
                    {formatHkd(f.valueHkd)}
                  </span>
                  {f.returnRate != null && (
                    <span
                      className={`w-12 shrink-0 text-right text-xs ${gainLossClass(f.returnRate)}`}
                    >
                      {f.returnRate > 0 ? '+' : ''}
                      {f.returnRate.toFixed(1)}%
                    </span>
                  )}
                </button>
              ))}
            </SectionCard>
          )}

          {/* Insurance — aggregate Cash Value vs Total Premiums */}
          {agg && agg.series.length > 0 && (
            <SectionCard title="Insurance · cash value vs premiums">
              <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-sm">
                <span className="text-text-secondary">
                  Cash value{' '}
                  <span className="text-text-primary">{formatHkd(agg.currentCash)}</span>
                </span>
                <span className="text-text-secondary">
                  Premiums{' '}
                  <span className="text-text-primary">
                    {formatHkd(agg.currentPremium)}
                  </span>
                </span>
                <span className="text-text-secondary">
                  Past break-even{' '}
                  <span className="text-text-primary">
                    {agg.pastBreakEven}/{agg.activeCount}
                  </span>
                </span>
              </div>
              <div className="px-2 py-3">
                <Suspense
                  fallback={
                    <p className="py-10 text-center text-sm text-text-secondary">
                      Loading chart…
                    </p>
                  }
                >
                  <InsuranceTrendChart
                    data={agg.series}
                    breakEvenAge={agg.breakEvenAge}
                  />
                </Suspense>
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  )
}
