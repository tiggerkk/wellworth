interface FilterPillProps {
  label: string
  /**
   * Selected/toggle state — accent fill + `aria-pressed`. Omit for a plain navigational or
   * display-only pill (rendered inactive, no `aria-pressed`).
   */
  selected?: boolean
  /** Tap handler. When omitted the pill is a non-interactive `<span>` (display-only tags). */
  onClick?: () => void
}

/**
 * The shared filter/tag pill — a rounded `text-body` chip, `bg-input text-text-primary` (whiter,
 * larger than the old captions) when inactive, accent-filled when `selected`. Used by the Quotes
 * Library tag facet, the Literature poem filters, the Poets list, and a poem's tag list.
 */
export function FilterPill({ label, selected, onClick }: FilterPillProps) {
  const className = `rounded-pill px-3 py-1 text-body ${
    selected ? 'bg-accent text-bg' : 'bg-input text-text-primary'
  }`
  if (!onClick) return <span className={className}>{label}</span>
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={className}>
      {label}
    </button>
  )
}
