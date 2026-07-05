import type { ComponentType } from 'react'

interface IconActionProps {
  Icon: ComponentType<{ size?: number; className?: string; stroke?: number }>
  /** Accessible label (also the title). */
  label: string
  onClick: () => void
  disabled?: boolean
  /**
   * Tint when enabled: `secondary` (Delete/Copy), `positive` (Add, or Paste when the clipboard
   * holds items). Disabled always renders muted (`text-text-tertiary`).
   */
  tone?: 'secondary' | 'positive'
  /** Icon stroke weight (Add uses a heavier 2.25). */
  stroke?: number
}

/**
 * Header action icon-button shared by the Diary day header and group headers.
 * Tabler icon at size 18, `p-1` hit area.
 */
export function IconAction({
  Icon,
  label,
  onClick,
  disabled = false,
  tone = 'secondary',
  stroke,
}: IconActionProps) {
  const color = disabled
    ? 'text-text-tertiary'
    : tone === 'positive'
      ? 'text-positive'
      : 'text-text-secondary'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`shrink-0 p-1 ${color}`}
    >
      <Icon size={18} stroke={stroke} />
    </button>
  )
}
