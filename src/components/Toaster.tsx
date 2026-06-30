import { useToast } from '../lib/toast'

/**
 * Renders the current transient toast (see `src/lib/toast.ts`). Mounted once in `AppShell` so it
 * overlays every screen. Sits just above the bottom nav, centered, non-interactive.
 */
export function Toaster() {
  const message = useToast()
  if (!message) return null
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4"
      aria-live="polite"
    >
      <div className="animate-[slideUp_200ms_ease-out] rounded-pill border border-border bg-surface px-4 py-2 text-body text-text-primary shadow-lg motion-reduce:animate-none">
        {message}
      </div>
    </div>
  )
}
