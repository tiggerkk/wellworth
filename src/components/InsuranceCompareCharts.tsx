import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatNative,
  formatNativeCompact,
  type Currency,
  type ScheduleComparisonRow,
} from '../lib/networth'

const AXIS = 'var(--color-text-secondary)'
const GRID = 'var(--color-border)'
const COLOR_A = 'var(--color-accent)'
const COLOR_B = 'var(--color-positive)'

/**
 * Cash Value chart + Gain %/Yr chart for the Insurance Compare Schedules overlay, stacked (not
 * dual-axis) — Cash is tens of thousands in the policy's native currency, Gain %/Yr is a small
 * percentage, and the two don't read well sharing one Y-axis. Both charts share the same X-axis
 * (Age). Values stay in the policy's own `currency`, never converted to HKD (unlike the
 * Dashboard's aggregate `InsuranceTrendChart`, which is HKD-only by design).
 * Lazy-loaded by `InsuranceCompareOverlay` so recharts stays in its own chunk.
 */
export function InsuranceCompareCharts({
  rows,
  currency,
  labelA,
  labelB,
}: {
  rows: ScheduleComparisonRow[]
  currency: Currency
  labelA: string
  labelB: string
}) {
  // A synthetic "band" series (min/max of the two cash values) shades the gap between the lines.
  const cashData = rows.map((r) => ({
    age: r.age,
    cashA: r.cashA,
    cashB: r.cashB,
    band:
      r.cashA != null && r.cashB != null
        ? [Math.min(r.cashA, r.cashB), Math.max(r.cashA, r.cashB)]
        : null,
  }))
  const gainData = rows.map((r) => ({ age: r.age, gainA: r.gainA, gainB: r.gainB }))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-caption uppercase tracking-[0.08em] text-text-secondary">
          Cash
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={cashData}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="age"
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={20}
            />
            <YAxis
              tickFormatter={(v: number) => formatNativeCompact(v, currency)}
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                color: 'var(--color-text-primary)',
              }}
              labelFormatter={(a) => `Age ${a}`}
              formatter={(value, name) => {
                if (name === 'band') return [null, null] as unknown as [string, string]
                const label = name === 'cashA' ? labelA : labelB
                return [formatNative(Number(value), currency), label]
              }}
            />
            <Legend
              formatter={(name) =>
                name === 'cashA' ? labelA : name === 'cashB' ? labelB : ''
              }
              wrapperStyle={{ fontSize: 11 }}
            />
            {/* Shaded variance band between the two cash lines. */}
            <Area
              dataKey="band"
              stroke="none"
              fill="var(--color-text-muted)"
              fillOpacity={0.12}
              legendType="none"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cashA"
              stroke={COLOR_A}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="cashB"
              stroke={COLOR_B}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="mb-1 text-caption uppercase tracking-[0.08em] text-text-secondary">
          Gain %/Yr
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={gainData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="age"
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={20}
            />
            <YAxis
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                color: 'var(--color-text-primary)',
              }}
              labelFormatter={(a) => `Age ${a}`}
              formatter={(value, name) => [
                `${Number(value).toFixed(2)}%`,
                name === 'gainA' ? labelA : labelB,
              ]}
            />
            <Legend
              formatter={(name) => (name === 'gainA' ? labelA : labelB)}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="gainA"
              stroke={COLOR_A}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="gainB"
              stroke={COLOR_B}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
