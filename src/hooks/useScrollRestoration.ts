import { useEffect, type RefObject } from 'react'

const positions = new Map<string, number>()

/**
 * Restores a scrollable element's `scrollTop` when `key` is revisited, and remembers the current
 * position just before `key` changes again. Wired once in `AppShell` around the shared `<main>`
 * (keyed by `pathname + search`) so returning to a Listing screen from an Edit/View page — or from
 * any other navigation — doesn't lose the person's place in a long list.
 *
 * `positions` is module-scoped rather than component state: `AppShell` mounts once for the app
 * session and re-renders on every route change (it doesn't remount), so a plain `useRef` would work
 * just as well here, but a module map also survives if this hook is ever attached to more than one
 * element. Resets on a full page reload, which is the right behavior (nothing here is meant to
 * persist across sessions).
 */
export function useScrollRestoration(
  ref: RefObject<HTMLElement | null>,
  key: string,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const target = positions.get(key) ?? 0
    el.scrollTop = target

    // The list being returned to (cached data resolving, images loading, a freshly-remounted
    // Listing screen) can still be shorter than `target` at the exact moment this effect fires —
    // the assignment above then gets silently clamped to whatever's scrollable *right now* (often
    // 0). Keep re-asserting `target` across a few animation frames as the content grows, so
    // restoration doesn't depend on winning a race against the list's own render pass. Stops once
    // the content is tall enough to actually hold `target` and the assignment has stuck, or after
    // ~20 frames (~300ms) if it never gets there (e.g. the list is genuinely shorter now).
    let frame = 0
    let raf = requestAnimationFrame(function retry() {
      if (el.scrollTop < target && el.scrollHeight - el.clientHeight >= target) {
        el.scrollTop = target
      }
      frame += 1
      if (frame < 20) raf = requestAnimationFrame(retry)
    })

    return () => {
      cancelAnimationFrame(raf)
      positions.set(key, el.scrollTop)
    }
  }, [ref, key])
}
