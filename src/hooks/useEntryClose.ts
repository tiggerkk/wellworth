import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { showToast } from '../lib/toast'
import { useDiscardConfirm } from './useDiscardConfirm'

interface UseEntryCloseOptions {
  /** Editing an existing item (id present) vs creating a new one. Drives every rule below. */
  editing: boolean
  /** Whether the draft has unsaved changes — gates the discard-confirm and the beforeunload guard. */
  dirty: boolean
  /** This module's fixed Listing route (e.g. `routes.quotes.library`). Used as: (a) Edit Item's
   *  Cancel/Save target for a Category-2 module (no View Item page), and (b) New Item's Cancel
   *  fallback for *any* module, when there's no history to pop (direct load/refresh). */
  listing: string
  /** Builds the fixed Edit route for a newly-created item's id — New Item's post-Save target for a
   *  Category-2 module (Shows, Books, Quotes, Insurance, Travel). Ignored when `newSaveTarget` is
   *  given (Category 1). */
  editRoute: (id: string) => string
  /** Category-1 override (a module WITH a View Item page, e.g. Medical): Edit Item's Cancel/Save
   *  target — the current item's View Item route, computed by the caller (it already has `id` in
   *  scope). Omit for Category 2, where this is just `listing`. */
  editTarget?: string
  /** Category-1 override: New Item's post-Save target, given the newly created id — the new item's
   *  View Item route. Omit for Category 2, where this is just `editRoute`. */
  newSaveTarget?: (newId: string) => string
  /** This module's Dashboard route. When Edit/View was opened via a `fromDashboard`-tagged
   *  navigation (a Dashboard row), Cancel/Close returns there instead of `editTarget ?? listing`.
   *  Omit for modules with no Dashboard link into Edit/View — Cancel/Close always goes to
   *  `editTarget ?? listing` then, same as before this option existed. */
  dashboard?: string
}

interface UseEntryCloseResult {
  /** Wire to the header's close button and Escape key. Opens the discard-confirm if dirty;
   *  otherwise navigates immediately. */
  requestClose: () => void
  /** Call after a successful save, with an optional toast message. Edit Item -> `editTarget` (or
   *  `listing` for Category 2); New Item -> `newSaveTarget(newId)` (or `editRoute(newId)` for
   *  Category 2), with history replaced so a later Close can't reopen the New form via back nav. */
  afterSave: (newId: string, toastMessage?: string) => void
  /** Pass straight to `<ConfirmDialog />`. */
  confirm: {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
  }
}

/** Pass as the second argument to `navigate()` from a Dashboard row that links to Edit/View, so
 *  that screen's Cancel/Close (via this hook's `dashboard` option) returns to the Dashboard instead
 *  of Listing. Not needed for links from a Listing row — that's the default when this is absent. */
export const fromDashboard = { state: { from: 'dashboard' } } as const

/**
 * Fixed-destination Save/Cancel navigation for an Entry screen, replacing the previous
 * `navigate(-1)` / `location.key === 'default'` pattern.
 *
 * Covers both nav-model categories:
 * - **Category 2** (Shows, Books, Quotes, Insurance, Travel — no View Item page): pass `listing` +
 *   `editRoute`. Edit Item's Cancel/Save go to the fixed Listing; New Item's Save goes to the new
 *   item's Edit route.
 * - **Category 1** (Medical — has a View Item page): additionally pass `editTarget` (the current
 *   item's View Item route) and `newSaveTarget` (a function to the new item's View Item route).
 *   Edit Item's Cancel/Save and New Item's Save all go to View Item instead.
 *
 * Using a fixed destination (rather than a history pop) for Edit Item's Cancel/Save is what fixes
 * the Travel "X after creating a new trip lands on the wrong trip's Edit screen" bug: that bug was
 * a symptom of relying on the history stack, which a `{ replace: true }` earlier in the flow can
 * put a different item's route behind the current one. A fixed destination sidesteps the history
 * stack entirely.
 *
 * New Item's Cancel still returns via history (`navigate(-1)`) rather than a fixed route, because
 * "Source" is genuinely dynamic — New is always entered by a *push* from the bottom nav, wherever
 * the person happened to be (Dashboard, Library, Map, ...), and there's no single fixed answer for
 * "where New was opened from". The one exception is a direct load/refresh of the New route itself
 * (`location.key === 'default'`, i.e. there's no app history to pop) — that falls back to `listing`
 * instead of popping out of the app entirely.
 */
export function useEntryClose({
  editing,
  dirty,
  listing,
  editRoute,
  editTarget,
  newSaveTarget,
  dashboard,
}: UseEntryCloseOptions): UseEntryCloseResult {
  const navigate = useNavigate()
  const location = useLocation()
  const cameFromDashboard =
    (location.state as { from?: string } | null)?.from === 'dashboard'

  const goToCancelTarget = useCallback(() => {
    // `{ replace: true }` here is what stops View <-> Edit from ping-ponging: without it, each
    // Cancel push a *new* View/Listing entry on top of Edit rather than collapsing back into the
    // one that put Edit there, so the next Back lands on Edit again instead of continuing outward.
    if (editing) {
      const target = cameFromDashboard && dashboard ? dashboard : (editTarget ?? listing)
      navigate(target, { replace: true })
    } else if (location.key === 'default') navigate(listing)
    else navigate(-1)
  }, [editing, editTarget, listing, dashboard, cameFromDashboard, navigate, location.key])

  const { requestClose, confirm } = useDiscardConfirm(dirty, goToCancelTarget)

  const afterSave = useCallback(
    (newId: string, toastMessage?: string) => {
      if (toastMessage) showToast(toastMessage)
      if (editing) navigate(editTarget ?? listing, { replace: true })
      else navigate((newSaveTarget ?? editRoute)(newId), { replace: true })
    },
    [editing, editTarget, listing, newSaveTarget, editRoute, navigate],
  )

  // Browser/tab close with unsaved changes. Most mobile browsers ignore the custom string and show
  // their own generic prompt — `returnValue` is set only because some engines still require it.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  return {
    requestClose,
    afterSave,
    confirm,
  }
}
