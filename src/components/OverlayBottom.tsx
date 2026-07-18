import { type ReactNode } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface OverlayBottomProps {
  children: ReactNode
  onClose: () => void
  label: string
}

/**
 * Fixed-overlay shell for a **local** (non-routed) bottom-anchored overlay — the picker/detail
 * sheets that slide up from the bottom rather than covering the whole screen (a date picker, a
 * reorder list, an expanded chart). Handles the scrim, dialog semantics, bottom safe-area inset,
 * rounded top corners, and Esc-to-close so each caller doesn't have to re-type them; the caller
 * supplies its own header/body content and any of its own padding.
 *
 * Caps at 85% of the viewport height and clips overflow (`max-h-[85vh] flex flex-col`) so content
 * that can grow unboundedly (a long reorder list, a long trend) never pushes past the top of the
 * screen. Short, fixed-height content (a calendar grid, a month picker) is unaffected since it
 * never approaches the cap. Callers with content that can exceed the cap should make their
 * scrollable region `min-h-0 flex-1 overflow-y-auto` so the header stays pinned and only the body
 * scrolls; callers with short content need no changes.
 *
 * Sibling to `OverlayTop`, which anchors full-screen from the top instead of as a bottom sheet.
 */
export function OverlayBottom({ children, onClose, label }: OverlayBottomProps) {
  useEscapeKey(onClose)
  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[90vh] w-full max-w-md flex-col rounded-t-card bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        {children}
      </div>
    </div>
  )
}
