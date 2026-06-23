/**
 * A tiny, dependency-free inline-SVG sparkline. Generic (knows nothing about Medical) so it stays
 * cheap to render many at once — the Medical Dashboard draws one per tracked test without pulling in
 * Recharts (that lands only in the expanded single-test chart). Values are min–max normalized to fit
 * the box; a single value renders just the end dot.
 */
interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  /** Line stroke (CSS colour). Defaults to the accent token. */
  color?: string
  /** End-dot fill — e.g. a flag colour for the latest reading. Defaults to `color`. */
  endColor?: string
  strokeWidth?: number
  className?: string
}

export function Sparkline({
  values,
  width = 100,
  height = 32,
  color = 'var(--color-accent)',
  endColor,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  if (values.length === 0) return null

  const pad = strokeWidth + 1
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const n = values.length
  const xAt = (i: number) =>
    n === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (n - 1)
  const yAt = (v: number) => height - pad - ((v - min) / span) * (height - 2 * pad)

  const pts = values.map((v, i) => [xAt(i), yAt(v)] as const)
  const d = pts
    .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`)
    .join(' ')
  const [lastX, lastY] = pts[pts.length - 1]!

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      {n > 1 && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle cx={lastX} cy={lastY} r={strokeWidth + 0.75} fill={endColor ?? color} />
    </svg>
  )
}
