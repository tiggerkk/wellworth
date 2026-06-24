import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatHkd } from '../lib/expenses'

export interface ExpenseSlice {
  label: string
  hkd: number
}

/** Donut palette — coral-led, distinct hues that read on the dark surface. */
const COLORS = [
  '#e8623c',
  '#5dcaa5',
  '#5b8def',
  '#e0b341',
  '#a978e0',
  '#e06aa0',
  '#54b3c4',
  '#9aa3b5',
]

/**
 * Per-category expense breakdown donut (recharts). Lazy-loaded by the Expenses panel so recharts stays
 * in its shared chart chunk. Values are HKD-equivalents (cross-currency); colours come from `COLORS`.
 */
export function TravelExpenseChart({ data }: { data: ExpenseSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="hkd"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={1}
          stroke="var(--color-surface)"
        >
          {data.map((d, i) => (
            <Cell key={d.label} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            color: 'var(--color-text-primary)',
          }}
          formatter={(value, name) => [formatHkd(Number(value)), String(name)]}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
