import { type ReactNode } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface OverlayTopProps {
  children: ReactNode
  onClose: () => void
  label: string
}

/**
 * Fixed-overlay shell for a **local** (non-routed) full-screen overlay — the search/picker
 * overlays that must stay inside the calling screen's own React tree so its in-progress draft
 * survives (using the routing `Sheet` here would put the caller behind a background-location and
 * remount it). Handles the scrim, dialog semantics, top safe-area inset, and Esc-to-close so each
 * caller doesn't have to re-type them; the caller supplies its own header/body content.
 */
export function OverlayTop({ children, onClose, label }: OverlayTopProps) {
  useEscapeKey(onClose)
  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-0 flex flex-col bg-surface pt-[env(safe-area-inset-top)]"
      >
        {children}
      </div>
    </div>
  )
}
