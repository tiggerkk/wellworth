import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOAD_FLAG = 'ww:chunk-reload'

/**
 * `React.lazy` that self-heals after a deploy. The installed PWA can keep referencing the previous
 * build's hashed chunk filenames; requesting one that no longer exists returns the SPA fallback
 * `index.html` instead of JS — which surfaces as "'text/html' is not a valid JavaScript MIME type"
 * (or "Failed to fetch dynamically imported module"), most visibly on an installed iPhone PWA whose
 * service worker updates lazily.
 *
 * On that failure we force a **one-time** full reload to pull the fresh `index.html` + chunk names; a
 * `sessionStorage` guard prevents a reload loop if the import is genuinely broken (the second failure
 * rethrows so the route's error UI shows). The flag is cleared on a successful load.
 */
// Mirror React.lazy's own generic constraint (`ComponentType<any>`) so any component — with whatever
// props — flows through transparently; T is still inferred precisely from `factory`, keeping prop
// types intact at every call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory()
      sessionStorage.removeItem(RELOAD_FLAG)
      return mod
    } catch (err) {
      if (typeof window !== 'undefined' && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1')
        window.location.reload()
        // Never resolve — the reload replaces the page before React can render the rejection.
        return new Promise<{ default: T }>(() => {})
      }
      throw err
    }
  })
}
