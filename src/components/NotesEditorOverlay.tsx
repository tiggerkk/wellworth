import { useEffect, useRef, useState } from 'react'
import { IconClipboard } from '@tabler/icons-react'
import { OverlayTop } from './OverlayTop'
import { OverlayCloseButton } from './OverlayCloseButton'
import { EntryHeaderActions } from './EntryHeaderActions'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface NotesEditorOverlayProps {
  /** Item title for the header (line 1). */
  title: string
  /** Release / publication year; when null the title shows alone (no parentheses). Ignored when
   *  `title` already contains everything line 1 needs (e.g. a pre-formatted date - type string). */
  year?: number | null
  /** Optional line 2, rendered in secondary/caption style under the title (e.g. a provider or
   *  studio name). Omitted entirely when null/empty. */
  subtitle?: string | null
  /** Label for the field being edited — used above the textarea and in the dialog's aria-label.
   *  Defaults to 'Notes'. */
  fieldLabel?: string
  /** Current field value from the parent form. */
  value: string
  /** Apply the edited buffer back to the parent form field (does not persist to the DB). */
  onSave: (next: string) => void
  /** Close + discard the buffer (Cancel). */
  onClose: () => void
}

const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard

/**
 * Full-screen editor for a long free-text field (Notes, Narrative, …). A **buffered** editor: it
 * edits a local copy and only `onSave` writes it back to the parent form (the form's own Save then
 * persists). Reuses the shared `EntryHeaderActions` cluster — Delete clears the text (two-step
 * confirm), Reset reverts to the value at open, Save applies + closes — with a top-left X to Cancel
 * (discard). Local overlay (not a route), modelled on `Calendar`.
 *
 * Shared across Books/Shows Notes and the Medical Narrative editor — see the callers for how the
 * header is composed (title + optional year, vs. a pre-formatted "Date - Type" + provider subtitle).
 */
export function NotesEditorOverlay({
  title,
  year = null,
  subtitle = null,
  fieldLabel = 'Notes',
  value,
  onSave,
  onClose,
}: NotesEditorOverlayProps) {
  const [buffer, setBuffer] = useState(value)
  const taRef = useRef<HTMLTextAreaElement>(null)
  // Caret to restore after a programmatic paste (null = leave the caret where the browser put it).
  const pendingCaret = useRef<number | null>(null)
  useEscapeKey(onClose)

  const trimmed = title.trim()
  const headerTitle = trimmed
    ? year != null
      ? `${trimmed} (${year})`
      : trimmed
    : fieldLabel
  const dirty = buffer !== value

  // Focus the textarea on open with the caret at the end (ready to append).
  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  // After a paste re-renders the textarea, restore the caret to just past the inserted text.
  useEffect(() => {
    const pos = pendingCaret.current
    if (pos == null || !taRef.current) return
    taRef.current.focus()
    taRef.current.setSelectionRange(pos, pos)
    pendingCaret.current = null
  }, [buffer])

  // Insert clipboard text at the cursor (replacing any selection) rather than overwriting the field.
  // The textarea's selectionStart/End survive the button taking focus, so we read them off the ref.
  async function pasteAtCursor() {
    const el = taRef.current
    if (!el) return
    const start = el.selectionStart ?? buffer.length
    const end = el.selectionEnd ?? buffer.length
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      pendingCaret.current = start + text.length
      setBuffer(buffer.slice(0, start) + text + buffer.slice(end))
    } catch {
      // Clipboard read denied/unavailable — silently no-op (the field stays editable).
    }
  }

  return (
    <OverlayTop onClose={onClose} label="Edit ${fieldLabel.toLowerCase()}">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <OverlayCloseButton onClick={onClose} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-heading font-medium text-text-primary">
            {headerTitle}
          </h1>
          {subtitle && (
            <p className="truncate text-caption text-text-secondary">{subtitle}</p>
          )}
        </div>
        <EntryHeaderActions
          editing
          dirty={dirty}
          saving={false}
          onReset={() => setBuffer(value)}
          onDelete={() => setBuffer('')}
          onSubmit={() => {
            onSave(buffer)
            onClose()
          }}
        />
      </header>

      <div className="flex flex-1 flex-col overflow-hidden p-4">
        <div className="flex items-center justify-between">
          <span className="text-caption text-text-secondary">{fieldLabel}</span>
          {canPaste && (
            <button
              onClick={() => void pasteAtCursor()}
              className="flex items-center gap-1 text-caption text-accent"
            >
              <IconClipboard size={14} /> Paste
            </button>
          )}
        </div>
        <textarea
          ref={taRef}
          value={buffer}
          onChange={(e) => setBuffer(e.target.value)}
          className="field-control mt-1 w-full flex-1 resize-none overflow-y-auto"
        />
      </div>
    </OverlayTop>
  )
}
