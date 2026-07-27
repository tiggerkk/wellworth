import {
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'

export interface CircumplexPoint {
  key: string
  label: string
  color: string
  valence: number
  arousal: number
  count: number
}

const AXIS = 'var(--color-text-secondary)'
const GRID = 'var(--color-border)'
const MIN_RADIUS = 8
const MAX_RADIUS = 32

/**
 * Journal Dashboard's Russell's Circumplex Model chart — one bubble per mood at its fixed
 * valence/arousal position (see `JOURNAL_MOOD_POSITIONS`), sized by entry count in the selected
 * interval. Not a per-entry scatter (Journal only records one discrete mood per entry, not a
 * continuous emotional coordinate) — see that constant's doc comment for the simplification this
 * makes. Lazy-loaded by the dashboard so recharts stays in its own chunk.
 */
export function JournalCircumplexChart({ points }: { points: CircumplexPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 20 }}>
        <XAxis
          type="number"
          dataKey="valence"
          domain={[-1, 1]}
          tick={false}
          axisLine={{ stroke: GRID }}
          label={{
            value: 'Unpleasant · Pleasant',
            position: 'bottom',
            fill: AXIS,
            fontSize: 11,
          }}
        />
        <YAxis
          type="number"
          dataKey="arousal"
          domain={[-1, 1]}
          tick={false}
          axisLine={{ stroke: GRID }}
          label={{
            value: 'Arousal',
            angle: -90,
            position: 'left',
            fill: AXIS,
            fontSize: 11,
          }}
        />
        {/* Bubble size — count in the selected interval; recharts scales relative to the data's
            own min/max count, so the largest bubble in view is always MAX_RADIUS. */}
        <ZAxis
          dataKey="count"
          range={[MIN_RADIUS * MIN_RADIUS, MAX_RADIUS * MAX_RADIUS]}
        />
        <ReferenceLine x={0} stroke={GRID} />
        <ReferenceLine y={0} stroke={GRID} />
        <Tooltip
          cursor={false}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            color: 'var(--color-text-primary)',
          }}
          formatter={(_value, _name, item) => {
            const p = item.payload as CircumplexPoint
            return [`${p.count} entr${p.count === 1 ? 'y' : 'ies'}`, p.label]
          }}
        />
        <Scatter data={points} fill="var(--color-accent)">
          {points.map((p) => (
            <Cell key={p.key} fill={p.color} fillOpacity={p.count > 0 ? 0.85 : 0.2} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}
