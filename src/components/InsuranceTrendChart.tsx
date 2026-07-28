import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatHkd, formatHkdCompact } from '../lib/networth'
import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP_STYLE } from '../lib/chart-theme'

export interface InsuranceAggPoint {
  age: number
  cash: number
  premium: number
}

/**
 * Aggregate insurance "Cash Value vs Total Premiums by age" (HKD), with the break-even age marked.
 * Lazy-loaded by the Net Worth dashboard so recharts stays in its own chunk.
 */
export function InsuranceTrendChart({
  data,
  breakEvenAge,
}: {
  data: InsuranceAggPoint[]
  breakEvenAge: number | null
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_GRID} vertical={false} />
        <XAxis
          dataKey="age"
          tick={{ fill: CHART_AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
          minTickGap={20}
        />
        <YAxis
          tickFormatter={(v: number) => formatHkdCompact(v)}
          tick={{ fill: CHART_AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={58}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          labelFormatter={(a) => `Age ${a}`}
          formatter={(value, name) => [
            formatHkd(Number(value)),
            name === 'cash' ? 'Cash Value' : 'Total Premiums',
          ]}
        />
        <Legend
          formatter={(name) => (name === 'cash' ? 'Cash Value' : 'Total Premiums')}
          wrapperStyle={{ fontSize: 11 }}
        />
        {breakEvenAge != null && (
          <ReferenceLine
            x={breakEvenAge}
            stroke="var(--color-positive)"
            strokeDasharray="4 3"
            label={{
              value: 'break-even',
              fill: CHART_AXIS,
              fontSize: 10,
              position: 'top',
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="premium"
          stroke="var(--color-text-muted)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="cash"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
