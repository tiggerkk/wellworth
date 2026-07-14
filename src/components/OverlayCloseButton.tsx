import { IconX } from '@tabler/icons-react'

/**
 * Shared `X` close button for a `OverlayTop`'s header row. Unlike `SheetCloseButton` (which is
 * wired to `navigate(-1)` for routed sheets), this takes a plain `onClick` since a local overlay
 * has no route of its own to go back from.
 */
export function OverlayCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Close" className="shrink-0">
      <IconX size={22} className="text-text-secondary" />
    </button>
  )
}
