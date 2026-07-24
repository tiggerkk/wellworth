interface LabelChipProps {
  /** The label to show (e.g. a dynasty, category, or provider name). */
  label: string
  /** Palette classes for this label (colour is caller-supplied — no shared tone set yet). */
  className?: string
  /** Accent color (CSS value, e.g. a `var(--color-*)` or palette token) for a solid-fill chip.
   *  Takes precedence over any bg/text tone classes in `className` — use for per-entry dynamic colors. */
  color?: string
}

/** A non-status label pill: rounded-md (vs. `StatusChip`'s rounded-pill) so labels read apart from
 * statuses at a glance. Presentational only. */
export function LabelChip({ label, className = '', color }: LabelChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-section font-medium ${className}`}
      style={color ? { backgroundColor: color, color: 'var(--color-bg)' } : undefined}
    >
      {label}
    </span>
  )
}
