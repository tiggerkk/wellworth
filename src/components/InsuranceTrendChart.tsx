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

export interface InsuranceAggPoint {
  age: number
  cash: number
  premium: number
}

const AXIS = 'var(--color-text-secondary)'
const GRID = 'var(--color-border)'

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
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="age"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={20}
        />
        <YAxis
          tickFormatter={(v: number) => formatHkdCompact(v)}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={58}
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
            label={{ value: 'break-even', fill: AXIS, fontSize: 10, position: 'top' }}
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
