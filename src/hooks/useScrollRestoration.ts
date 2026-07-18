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
    el.scrollTop = positions.get(key) ?? 0
    return () => {
      positions.set(key, el.scrollTop)
    }
  }, [ref, key])
}
