import { useState } from 'react'
import { IconCheck, IconTrash, IconX } from '@tabler/icons-react'

interface ConfirmDeleteActionProps {
  /** Accessible label (also the title) for the trash button, e.g. "Delete all entries today". */
  label: string
  onDelete: () => void
  disabled?: boolean
}

/**
 * Trash icon-button that flips to an inline `Delete? ✓ ✗` confirm before firing — the compact,
 * icon-row counterpart to `EntryHeaderActions`' two-step delete. Styled to match `IconAction`
 * (size-18 Tabler icon, `p-1` hit area) so it drops into a header/icon cluster; sibling icons
 * (Copy/Paste/Add) stay visible during confirm, with the "Delete?" text disambiguating. `disabled`
 * blocks entering the confirm state.
 */
export function ConfirmDeleteAction({
  label,
  onDelete,
  disabled = false,
}: ConfirmDeleteActionProps) {
  const [confirming, setConfirming] = useState(false)

  if (confirming && !disabled) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-xs text-text-secondary">Delete?</span>
        <button
          type="button"
          onClick={() => {
            setConfirming(false)
            onDelete()
          }}
          aria-label="Confirm delete"
          title="Confirm delete"
          className="shrink-0 p-1 text-danger"
        >
          <IconCheck size={18} />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          aria-label="Cancel delete"
          title="Cancel delete"
          className="shrink-0 p-1 text-text-secondary"
        >
          <IconX size={18} />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="shrink-0 p-1 text-text-secondary disabled:text-text-tertiary"
    >
      <IconTrash size={18} />
    </button>
  )
}
