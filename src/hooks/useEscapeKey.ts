import { useEffect, useRef } from 'react'

/**
 * Press-Escape-to-dismiss, shared by every overlay (route sheets, the Calendar, the SelectMenu
 * dropdown, the local search sheets) and the Add/Edit screens.
 *
 * A single document listener drives a LIFO stack of handlers so the **innermost** overlay wins:
 * only the most-recently-mounted (top-of-stack) enabled handler fires per Escape press. This is
 * why an Add/Edit screen can register `navigate(-1)` unconditionally — an open Calendar / dropdown
 * / search sheet sits above it on the stack and consumes the key first, so the screen only closes
 * when nothing is layered over it. Pass `enabled=false` to leave the stack (e.g. a closed dropdown).
 */
const stack: Array<() => void> = []

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  const top = stack[stack.length - 1]
  if (top) {
    e.preventDefault()
    top()
  }
}

export function useEscapeKey(handler: () => void, enabled = true): void {
  // Keep the latest handler in a ref (synced in an effect, never during render) so the registration
  // effect only re-runs when `enabled` flips — which keeps each overlay's stack position stable.
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })

  useEffect(() => {
    if (!enabled) return
    const entry = () => ref.current()
    stack.push(entry)
    if (stack.length === 1) document.addEventListener('keydown', onKeydown)
    return () => {
      const i = stack.lastIndexOf(entry)
      if (i !== -1) stack.splice(i, 1)
      if (stack.length === 0) document.removeEventListener('keydown', onKeydown)
    }
  }, [enabled])
}
