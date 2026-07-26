import type { ReactNode } from 'react'

interface KpiTileProps {
  /** The headline stat — a number (Travel's counts) or a short string (Journal's "Top Mood"). */
  value: ReactNode
  suffix?: string
  label: string
}

/**
 * A single KPI stat card: bold headline value (+ optional suffix) over a caption label. Used by
 * dashboard KPI grids across modules (Travel's count tiles, Journal's streak/total stats) —
 * pulled out once a second module needed the same shape, so the two can't drift apart.
 */
export function KpiTile({ value, suffix, label }: KpiTileProps) {
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-3">
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-semibold text-text-primary">{value}</span>
        {suffix && <span className="text-caption text-text-secondary">{suffix}</span>}
      </div>
      <p className="mt-0.5 text-caption leading-tight text-text-secondary">{label}</p>
    </div>
  )
}
