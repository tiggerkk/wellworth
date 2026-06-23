import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatFullDate, formatMonthShort } from '../lib/date'
import { MEDICAL_FLAG_COLOR, type MedicalFlag } from '../lib/medical'

/** One charted reading. `flag` colours its dot (the report's own range drives the flag). */
export interface MedicalChartPoint {
  date: string
  value: number
  flag: MedicalFlag | null
}

interface Props {
  points: MedicalChartPoint[]
  unit: string | null
  /** Optional reference band (the latest report's printed range) shaded behind the line. */
  refLow: number | null
  refHigh: number | null
}

const AXIS = 'var(--color-text-secondary)'
const GRID = 'var(--color-border)'

/** A dot coloured by its reading's flag (in-range = accent). Recharts passes loosely-typed props. */
function renderDot(props: unknown) {
  const { cx, cy, payload } = props as {
    cx?: number
    cy?: number
    payload?: MedicalChartPoint
  }
  if (cx == null || cy == null) return <circle r={0} />
  const color = payload?.flag ? MEDICAL_FLAG_COLOR[payload.flag] : 'var(--color-accent)'
  return <circle cx={cx} cy={cy} r={3} fill={color} />
}

/**
 * Full single-test trend chart (recharts). Imported **lazily** by the Dashboard's expanded view so
 * recharts only loads when a sparkline is opened (its own chunk). Colours come from the @theme CSS
 * vars to match the dark theme. Mirrors `NetWorthTrendChart`.
 */
export function MedicalTrendChart({ points, unit, refLow, refHigh }: Props) {
  const hasBand = refLow != null && refHigh != null
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        {hasBand && (
          <ReferenceArea
            y1={refLow}
            y2={refHigh}
            fill="var(--color-accent)"
            fillOpacity={0.08}
            stroke="none"
          />
        )}
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatMonthShort(d)}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={44}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            color: 'var(--color-text-primary)',
          }}
          labelFormatter={(d) => formatFullDate(String(d))}
          formatter={(value) => [`${value}${unit ? ` ${unit}` : ''}`, 'Value']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={renderDot}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
