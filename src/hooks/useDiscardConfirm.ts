import { useCallback, useState } from 'react'

interface UseDiscardConfirmResult {
  /** Wire to the close button / Escape key. Opens the confirm if `dirty`; otherwise calls
   *  `onDiscard` immediately. */
  requestClose: () => void
  /** Pass straight to `<ConfirmDialog />`. */
  confirm: {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
  }
}

/**
 * Gates a close action behind a discard-confirm when there are unsaved changes. This is the
 * confirm-dialog half of `useEntryClose` (which additionally handles routing) pulled out on its
 * own, for the local overlays that have a `dirty` flag and an `onClose` prop but no navigation of
 * their own — `NotesEditorOverlay`, `StopEditorOverlay`, and future ones in the same shape.
 */
export function useDiscardConfirm(
  dirty: boolean,
  onDiscard: () => void,
): UseDiscardConfirmResult {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const requestClose = useCallback(() => {
    if (dirty) setConfirmOpen(true)
    else onDiscard()
  }, [dirty, onDiscard])

  return {
    requestClose,
    confirm: {
      open: confirmOpen,
      onConfirm: () => {
        setConfirmOpen(false)
        onDiscard()
      },
      onCancel: () => setConfirmOpen(false),
    },
  }
}
