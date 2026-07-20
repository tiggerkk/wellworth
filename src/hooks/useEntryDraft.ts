import { useCallback, useMemo } from 'react'
import { useAsync } from './useAsync'

interface UseEntryDraftOptions<Row, Draft> {
  /** Present when editing an existing item; undefined for a New Item form. */
  id: string | undefined
  /** Fetches the row being edited. Only called when `id` is present. MUST be stable — a
   *  module-level function (like `getBook`) or a `useCallback` with correct deps. An inline arrow
   *  function here (`fetchRow: async (id) => {...}`) gets a new identity every render, which
   *  `loadFn` below depends on, which re-triggers `useAsync`'s fetch effect every render: an
   *  infinite refetch loop, not just a stale-data bug. (This exact mistake was shipped
   *  previously — a fresh network request on every render, hammering Supabase and
   *  spamming "Maximum update depth exceeded" until the browser gave up on the requests.) */
  fetchRow: (id: string) => Promise<Row | null>
  /** Maps a fetched row to the form's draft shape. Must be stable (`useCallback`/module-level) for
   *  the same reason — it's a dep of the `initial` memo below. */
  toDraft: (row: Row) => Draft
  /** Builds a blank draft for New Item mode (e.g. from `?prefill=` query params). Must be stable
   *  for the same reason. If it doesn't close over any component state (no prefill), a bare
   *  module-level function is simplest; if it does, wrap it in `useCallback` with the right deps
   *  (see `QuotesEntry`/`InsuranceEntry`). */
  blank: () => Draft
  /** OR'd into the returned `loading` — e.g. a profile fetch the blank/draft mapping also depends
   *  on (Quotes' Source Type / Category lists). */
  extraLoading?: boolean
}

interface UseEntryDraftResult<Draft> {
  initial: Draft | null
  loading: boolean
  error: Error | undefined
}

/**
 * The safe way to derive an Entry screen's "initial draft" from `id`. Fixes a whole class of bug:
 * navigating from Edit(A) straight to New (id -> undefined) by reusing the same routed screen can
 * briefly — or, if a field is only seeded once via `useState(initial.x)`, *permanently* — show A's
 * data under the New form. That happens because `useAsync` intentionally keeps the previous fetch's
 * `data` while a new fetch is in flight (see its docstring): fine for Edit(A) -> Edit(B), wrong for
 * Edit(A) -> New, where there's nothing to wait on at all.
 *
 * `initial` here is derived with a synchronous `useMemo` gated on `id`, so a New-mode render never
 * reads the async `row` — regardless of whether the fetch behind it has resolved.
 */
export function useEntryDraft<Row, Draft>({
  id,
  fetchRow,
  toDraft,
  blank,
  extraLoading = false,
}: UseEntryDraftOptions<Row, Draft>): UseEntryDraftResult<Draft> {
  const loadFn = useCallback(
    async (): Promise<Row | null> => (id ? fetchRow(id) : null),
    [id, fetchRow],
  )
  const { data: row, loading: rowLoading, error } = useAsync(loadFn)

  const initial = useMemo<Draft | null>(() => {
    if (id) return row ? toDraft(row) : null
    return blank()
  }, [id, row, toDraft, blank])

  return { initial, loading: rowLoading || extraLoading, error }
}
