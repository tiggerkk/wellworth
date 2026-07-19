import { type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface SheetProps {
  children: ReactNode
  /** 'bottom' = slide-up card (pickers); 'full' = full-screen logging flow. */
  variant?: 'bottom' | 'full'
  label: string
  /** Overrides the scrim-click / Esc close action (default `navigate(-1)`). Sheets with a dirty
   *  form (e.g. `WellnessFoodNewSheet`) pass a `useDiscardConfirm`-wrapped handler here so those
   *  two escape hatches can't skip the discard-confirm the header's X button already gets. */
  onClose?: () => void
}

/**
 * Slide-up overlay for route-based sheets. Closes on scrim click / Esc via `navigate(-1)` (or the
 * `onClose` override), so the device Back button unwinds the same way. Constrained to the app's
 * max-w-md column.
 */
export function Sheet({ children, variant = 'bottom', label, onClose }: SheetProps) {
  const navigate = useNavigate()
  const close = onClose ?? (() => navigate(-1))
  useEscapeKey(close)

  // Full-screen sheets are fixed overlays (outside the app shell's padded flow), so they reserve
  // the top safe-area inset themselves to keep their header clear of the iOS status bar.
  const panel =
    variant === 'full'
      ? 'inset-0 rounded-none pt-[env(safe-area-inset-top)]'
      : 'inset-x-0 bottom-0 mx-auto max-w-md rounded-t-card pb-[env(safe-area-inset-bottom)]'

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`absolute flex flex-col bg-surface motion-reduce:animate-none animate-[slideUp_200ms_ease-out] ${panel}`}
      >
        {/* 
          `pt-[env(safe-area-inset-top)]` above only pushes *normal-flow* content below the status
          bar — it has no effect on an absolutely-positioned descendant, whose `top` offset is
          measured from the padding box's outer edge (i.e. ignores padding-top entirely). Several
          Entry forms float their header actions with `absolute top-3 right-4` over a reserved
          space next to the title, which otherwise renders flush with the very top of the screen — 
          under the iOS status bar. This inner `relative` wrapper gives those floats a containing 
          block that already starts below the safe-area padding, so `top-3` there means 12px under 
          the status bar, not 12px under the physical top edge. `flex flex-1 min-h-0 flex-col` just 
          passes the outer panel's flex sizing through unchanged.
        */}
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
