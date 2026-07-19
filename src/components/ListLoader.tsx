import type { ReactNode } from 'react'

interface ListLoaderProps<T> {
  /** True while the async load is in flight. */
  loading: boolean
  /** Truthy when the load failed (an Error, or any truthy value). */
  error?: unknown
  /** The loaded array, or null/undefined when not yet resolved. */
  data: T[] | null | undefined
  /** Message shown on error, e.g. "Couldn’t load your shows." */
  errorText: ReactNode
  /** Rendered when the load succeeded but the list is empty (e.g. <EmptyState />). */
  emptyState: ReactNode
  /** Renders the list once data is present and non-empty (narrowed to non-empty T[]). */
  children: (data: T[]) => ReactNode
}

/**
 * The shared body-only branch for every Dashboard/Library list screen: `Loading…`, an error line,
 * an `EmptyState`, or — once data resolves non-empty — the list (via a render prop). Renders a
 * fragment (no wrapping element), so it drops in below sticky chrome (e.g. SegmentedTabs) without
 * affecting layout — that chrome stays mounted and visible across all three states. Distinct from
 * `EntryLoader`, which is for single-entity New/Edit form screens and conflates "error" with "not found."
 */
export function ListLoader<T>({
  loading,
  error,
  data,
  errorText,
  emptyState,
  children,
}: ListLoaderProps<T>) {
  const all = data ?? []
  return (
    <>
      {loading && <p className="px-4 py-6 text-body text-text-secondary">Loading…</p>}
      {error && <p className="px-4 py-6 text-body text-danger">{errorText}</p>}
      {!loading && !error && all.length === 0 && emptyState}
      {!loading && !error && all.length > 0 && children(all)}
    </>
  )
}
