import { IconX } from '@tabler/icons-react'

/**
 * Shared `X` close button for `Calendar`/`MonthPicker`'s bespoke centered-nav header (X hugs the
 * top-left corner, absolutely positioned, freeing the row for a centered `‹ month ›` cluster).
 * Every other Entry screen, Sheet, and local overlay uses `ScreenHeaderTitle` instead, whose close
 * button is wired to `navigate(-1)` by default; this one takes a plain `onClick` since it isn't
 * part of that shared header shape.
 */
export function OverlayCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Close" className="shrink-0">
      <IconX size={22} className="text-text-secondary" />
    </button>
  )
}
