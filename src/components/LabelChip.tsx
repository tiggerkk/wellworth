interface LabelChipProps {
  /** The label to show (e.g. a dynasty, category, or provider name). */
  label: string
  /** Layout-only classes (width, ring, opacity, shrink, margin). Never use this for padding or
   *  font-size — those are owned entirely by `size` so a caller's override can't silently lose to
   *  this component's own classes depending on Tailwind's generated-CSS order. */
  className?: string
  /** Accent color (CSS value, e.g. a `var(--color-*)` or palette token) for a solid-fill chip.
   *  Takes precedence over any bg/text tone classes in `className` — use for per-entry dynamic colors. */
  color?: string
  /** 'section' (11px, default, px-2 py-0.5) — compact contexts: row badges, category/dynasty chips.
   *  'body' (15px, px-2 py-0.5) — a primary, tappable choice rather than a compact label (e.g.
   *  Journal Entry's mood picker), matching the size of adjacent `SelectableChip`s.
   *  'compact' (10px, px-1.5 py-0) — the tightest variant, for a leading column badge stacked
   *  under something else (e.g. Journal Library's row mood chip under the date badge). */
  size?: 'section' | 'body' | 'compact'
}

const SIZE_CLASSES: Record<NonNullable<LabelChipProps['size']>, string> = {
  section: 'text-section px-2 py-0.5',
  body: 'text-body px-2 py-0.5',
  compact: 'text-[10px] px-1.5 py-0',
}

/** A non-status label chip: rounded-md (vs. `StatusChip`'s rounded-pill) so labels read apart from
 * statuses at a glance. Presentational only. */
export function LabelChip({
  label,
  className = '',
  color,
  size = 'section',
}: LabelChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${SIZE_CLASSES[size]} ${className}`}
      style={color ? { backgroundColor: color, color: 'var(--color-bg)' } : undefined}
    >
      {label}
    </span>
  )
}
