import { IconCheck } from '@tabler/icons-react'

interface SelectableChipProps {
  label: string
  /**
   * Selected/toggle state — accent fill + `aria-pressed`. Omit for a plain navigational or
   * display-only chip (rendered inactive, no `aria-pressed`).
   */
  selected?: boolean
  /** Tap handler. When omitted the chip is a non-interactive `<span>` (display-only tags). */
  onClick?: () => void
  /**
   * 'accent' (default) — the app-wide accent fill when selected (Quotes Library tag facet,
   * Literature filters, Poets list).
   * 'neutral' — a checkmark + a fill tied to `text-primary` rather than any palette swatch, for
   * contexts where "selected" must never be confused with a caller-configurable palette color
   * (e.g. Journal Entry's sub-tag suggestions, which sit right next to mood `LabelChip`s that can
   * be recolored to any swatch — including the same blue as the default accent).
   */
  tone?: 'accent' | 'neutral'
}

/**
 * The shared filter/tag chip — a rounded `text-body` chip, `bg-input text-text-primary` (whiter,
 * larger than the old captions) when inactive, accent-filled when `selected`. Used by the Journal / Quotes
 * Library tag facet, the Literature poem filters, the Poets list, and a poem's tag list.
 */
export function SelectableChip({
  label,
  selected,
  onClick,
  tone = 'accent',
}: SelectableChipProps) {
  const selectedClass =
    tone === 'neutral' ? 'bg-text-primary text-bg' : 'bg-accent text-bg'
  const className = `inline-flex items-center gap-1 rounded-pill px-3 py-1 text-body ${
    selected ? selectedClass : 'bg-input text-text-primary'
  }`
  const content = (
    <>
      {selected && tone === 'neutral' && <IconCheck size={13} />}
      {label}
    </>
  )
  if (!onClick) return <span className={className}>{content}</span>
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={className}>
      {content}
    </button>
  )
}
