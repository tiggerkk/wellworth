interface StatusChipProps {
  /** The label to show (e.g. 'Watching', 'Reading'). */
  label: string
  /** Palette classes for this status (from the module's `*_STATUS_CHIP` map). */
  className: string
}

/** A status pill in a module-supplied palette. Presentational — Shows and Books pass their own
 * label + palette so the single chip serves both without duplicating the visual. */
export function StatusChip({ label, className }: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-section font-medium ${className}`}
    >
      {label}
    </span>
  )
}
