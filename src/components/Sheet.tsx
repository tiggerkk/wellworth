import { type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface SheetProps {
  children: ReactNode
  /** 'bottom' = slide-up card (pickers); 'full' = full-screen logging flow. */
  variant?: 'bottom' | 'full'
  label: string
}

/**
 * Slide-up overlay for route-based sheets. Closes on scrim click / Esc via `navigate(-1)`,
 * so the device Back button unwinds the same way. Constrained to the app's max-w-md column.
 */
export function Sheet({ children, variant = 'bottom', label }: SheetProps) {
  const navigate = useNavigate()
  useEscapeKey(() => navigate(-1))

  // Full-screen sheets are fixed overlays (outside the app shell's padded flow), so they reserve
  // the top safe-area inset themselves to keep their header clear of the iOS status bar.
  const panel =
    variant === 'full'
      ? 'inset-0 rounded-none pt-[env(safe-area-inset-top)]'
      : 'inset-x-0 bottom-0 mx-auto max-w-md rounded-t-card pb-[env(safe-area-inset-bottom)]'

  return (
    <div className="fixed inset-0 z-30">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => navigate(-1)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`absolute flex flex-col bg-surface motion-reduce:animate-none animate-[slideUp_200ms_ease-out] ${panel}`}
      >
        {children}
      </div>
    </div>
  )
}
