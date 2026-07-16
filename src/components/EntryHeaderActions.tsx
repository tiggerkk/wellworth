import { useState } from 'react'
import {
  IconArrowBackUp,
  IconCheck,
  IconDeviceFloppy,
  IconHeart,
  IconHeartFilled,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { PrimaryButton } from './PrimaryButton'
import { SecondaryButton } from './SecondaryButton'

interface EntryHeaderActionsProps {
  /** Editing an existing record → show DELETE + a floppy Save; otherwise a plus Create. */
  editing: boolean
  dirty: boolean
  saving: boolean
  /** Extra gate on the submit action (e.g. a required title). Defaults to enabled. */
  canSubmit?: boolean
  onReset: () => void
  onSubmit: () => void
  /** Wired only when editing; the delete asks for an inline confirm first. */
  onDelete?: () => void
  /** Current favorite state. Only render the heart button when this and `onToggleFavorite` are
   *  both provided — omit both for entry forms that don't have a favorite concept. */
  favorite?: boolean
  /** Tapping the heart saves immediately (no Save button needed); see `useEntryFavorite`. */
  onToggleFavorite?: () => void
}

/**
 * The shared top-right entry-form action cluster: (optional) FAVORITE · DELETE · RESET · SUBMIT,
 * as compact `sm` icon buttons (see docs/04-design-system.md → Button placement). DELETE shows only
 * when editing and flips to a two-step inline confirm before firing. Submit shows a plus (new) /
 * floppy (editing). FAVORITE shows only when both `favorite` and `onToggleFavorite` are passed, and
 * saves immediately on tap rather than waiting for Submit.
 */
export function EntryHeaderActions({
  editing,
  dirty,
  saving,
  canSubmit = true,
  onReset,
  onSubmit,
  onDelete,
  favorite,
  onToggleFavorite,
}: EntryHeaderActionsProps) {
  const [confirming, setConfirming] = useState(false)
  const showFavorite = favorite !== undefined && !!onToggleFavorite

  if (confirming && editing && onDelete) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-caption text-text-secondary">Delete?</span>
        <button
          onClick={() => {
            setConfirming(false)
            onDelete()
          }}
          aria-label="Confirm delete"
          disabled={saving}
          className="flex items-center justify-center rounded-pill bg-danger px-3 py-1.5 text-bg disabled:opacity-50"
        >
          <IconCheck size={18} />
        </button>
        <button
          onClick={() => setConfirming(false)}
          aria-label="Cancel delete"
          className="flex items-center justify-center rounded-pill border border-border bg-surface-alt px-3 py-1.5 text-text-secondary"
        >
          <IconX size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {showFavorite && (
        <button
          onClick={onToggleFavorite}
          aria-label="Favorite"
          className="flex shrink-0 items-center justify-center p-1"
        >
          {favorite ? (
            <IconHeartFilled size={20} className="text-favorite" />
          ) : (
            <IconHeart size={20} className="text-text-tertiary" />
          )}
        </button>
      )}
      {editing && onDelete && (
        <button
          onClick={() => setConfirming(true)}
          aria-label="Delete"
          disabled={saving}
          className="flex items-center justify-center rounded-pill border border-border bg-surface-alt px-3 py-1.5 text-danger transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconTrash size={18} />
        </button>
      )}
      <SecondaryButton
        size="sm"
        onClick={onReset}
        disabled={!dirty || saving}
        aria-label="Reset"
      >
        <IconArrowBackUp size={18} />
      </SecondaryButton>
      <PrimaryButton
        size="sm"
        tone="positive"
        onClick={onSubmit}
        disabled={saving || !canSubmit || (editing && !dirty)}
        aria-label={editing ? 'Save' : 'Create'}
        aria-busy={saving}
      >
        {editing ? <IconDeviceFloppy size={18} /> : <IconPlus size={18} />}
      </PrimaryButton>
    </div>
  )
}
