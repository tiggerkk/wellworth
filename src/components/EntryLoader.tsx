import type { ReactNode } from 'react'

interface EntryLoaderProps<T> {
  /** True while the async load is in flight. */
  loading: boolean
  /** Truthy when the load failed (an Error, or any truthy value). */
  error?: unknown
  /** The loaded value, or null/undefined when missing (treated as "not found"). */
  data: T | null | undefined
  /** Message shown on error / not-found, e.g. "Couldn't load this show." */
  errorText: string
  /** Renders the form once the data is present (narrowed to non-null). */
  children: (data: T) => ReactNode
}

/**
 * The shared outer wrapper for every New/Edit entry screen: a full-height flex column that shows a
 * `Loading…` line, an error/not-found line, or — once the data resolves — the inner form (via a
 * render prop, so `data` is narrowed to non-null). Mirrors the `useAsync` outer-loader + inner-form
 * pattern; the caller still keys the form by id so a stale result never mounts under the wrong item.
 */
export function EntryLoader<T>({
  loading,
  error,
  data,
  errorText,
  children,
}: EntryLoaderProps<T>) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {loading && <p className="p-4 text-body text-text-secondary">Loading…</p>}
      {(error || (!loading && data == null)) && (
        <p className="p-4 text-body text-danger">{errorText}</p>
      )}
      {!loading && data != null && children(data)}
    </div>
  )
}
