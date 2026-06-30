interface NutrientBarProps {
  label: string
  value: number
  target: number | null
  unit: string
  /** Over a total-intake upper limit → red fill + danger % (see isOverUpperLimit). */
  over?: boolean
  /**
   * Drop the "value / target unit" text and keep only name + %. Used where the bar
   * lives in a narrow column (Diary highlighted nutrients, 2-col grid) so the % is
   * never crowded out by the full nutrient name.
   */
  compact?: boolean
}

function fmt(n: number): string {
  // Compact: drop trailing decimals for whole-ish numbers.
  return Math.abs(n) >= 100 || Number.isInteger(n) ? String(Math.round(n)) : n.toFixed(1)
}

/** name · value / target (muted) · % with a thin track+fill. Red variant when `over`. */
export function NutrientBar({
  label,
  value,
  target,
  unit,
  over = false,
  compact = false,
}: NutrientBarProps) {
  const pct = target && target > 0 ? (value / target) * 100 : null
  const fillWidth = pct == null ? 0 : Math.min(100, Math.max(0, pct))

  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate text-text-primary">{label}</span>
        <span className="shrink-0 text-text-secondary">
          {!compact && (
            <>
              {fmt(value)}
              {target != null && ` / ${fmt(target)}`} {unit}
            </>
          )}
          {pct != null && (
            <span
              className={`${compact ? '' : 'ml-1 '}${over ? 'text-danger' : 'text-text-muted'}`}
            >
              {Math.round(pct)}%
            </span>
          )}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-pill bg-track">
        <div
          className={`h-full rounded-pill ${over ? 'bg-danger' : 'bg-fill'}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
    </div>
  )
}
