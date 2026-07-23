import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatHkd } from '../lib/travel-expenses'
import {
  PALETTE_BLUE,
  PALETTE_BROWN,
  PALETTE_CYAN,
  PALETTE_EMERALD,
  PALETTE_GOLD,
  PALETTE_GREY,
  PALETTE_MAGENTA,
  PALETTE_PURPLE,
  PALETTE_RED,
  PALETTE_OFF_WHITE,
} from '../constants/palette'

export interface ExpenseSlice {
  label: string
  hkd: number
  /** The category's stable per-category colour (from `categoryColor`); falls back to the positional
   *  palette below when absent. */
  color?: string
}

/**
 * Fallback donut palette — distinct hues that read on the dark surface. Driven by the shared
 * palette constants (`src/constants/palette.ts`) so it tracks the theme. Used only when a slice
 * carries no explicit `color` (slices normally get a **stable per-category** colour via
 * `categoryColor`). Recharts resolves `var(...)` in `fill` (cf. `MedicalTrendChart`).
 */
const COLORS = [
  PALETTE_BLUE,
  PALETTE_GOLD,
  PALETTE_EMERALD,
  PALETTE_PURPLE,
  PALETTE_GREY,
  PALETTE_MAGENTA,
  PALETTE_BROWN,
  PALETTE_CYAN,
  PALETTE_RED,
  PALETTE_OFF_WHITE,
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
            <Cell key={d.label} fill={d.color ?? COLORS[i % COLORS.length]} />
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
