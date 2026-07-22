interface LabelChipProps {
  /** The label to show (e.g. a dynasty, category, or provider name). */
  label: string
  /** Palette classes for this label (colour is caller-supplied — no shared tone set yet). */
  className?: string
}

/** A non-status label pill: rounded-md (vs. `StatusChip`'s rounded-pill) so labels read apart from
 * statuses at a glance. Presentational only. */
export function LabelChip({ label, className = '' }: LabelChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-section font-medium ${className}`}
    >
      {label}
    </span>
  )
}
