import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ASSET_TYPE_COLORS,
  ASSET_TYPE_LABELS,
  formatHkd,
  formatHkdCompact,
  type AssetType,
} from '../lib/networth'
import { formatMonthShort } from '../lib/date'

/** A chart row keyed by `month` (ISO) plus numeric series (`total`, or one per asset type). */
export interface TrendRow {
  month: string
  [series: string]: number | string
}

interface Props {
  mode: 'total' | 'type'
  data: TrendRow[]
  presentTypes: AssetType[]
}

const AXIS = 'var(--color-text-secondary)'
const GRID = 'var(--color-border)'

/**
 * Net Worth trend line chart (recharts). Imported lazily by the dashboard so recharts lands in
 * its own chunk. Colors come from the @theme CSS vars so it matches the dark theme.
 */
export function NetWorthTrendChart({ mode, data, presentTypes }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(m: string) => formatMonthShort(m)}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={24}
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
          labelFormatter={(m) => formatMonthShort(String(m))}
          formatter={(value, name) => [
            formatHkd(Number(value)),
            mode === 'total'
              ? 'Net worth'
              : (ASSET_TYPE_LABELS[name as AssetType] ?? String(name)),
          ]}
        />
        {mode === 'total' ? (
          <Line
            type="monotone"
            dataKey="total"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={{ r: 2.5 }}
          />
        ) : (
          <>
            <Legend
              formatter={(name) => ASSET_TYPE_LABELS[name as AssetType] ?? String(name)}
              wrapperStyle={{ fontSize: 11 }}
            />
            {presentTypes.map((t) => (
              <Line
                key={t}
                type="monotone"
                dataKey={t}
                stroke={ASSET_TYPE_COLORS[t]}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            ))}
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
