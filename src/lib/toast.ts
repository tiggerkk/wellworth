import { useSyncExternalStore } from 'react'

/**
 * Minimal app-wide transient toast. Module-scoped so any screen can fire one without threading a
 * context/provider; a single `<Toaster />` mounted in `AppShell` renders the current message. Each
 * `showToast` replaces the previous message and resets a ~2s auto-dismiss timer. Not persisted —
 * purely a UI cue (e.g. "Copied Breakfast · 3 items").
 */
const DISMISS_MS = 2000

let message: string | null = null
let token = 0
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((l) => l())
}

export function showToast(msg: string): void {
  message = msg
  token += 1
  const mine = token
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    // Only clear if no newer toast superseded this one (defensive; mine === token here always).
    if (mine === token) {
      message = null
      emit()
    }
  }, DISMISS_MS)
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useToast(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => message,
    () => message,
  )
}
