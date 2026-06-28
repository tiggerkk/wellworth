import { useEffect, useRef, useState } from 'react'
import { IconClipboard, IconX } from '@tabler/icons-react'
import { EntryHeaderActions } from './EntryHeaderActions'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface NotesEditorModalProps {
  /** Item title for the header. */
  title: string
  /** Release / publication year; when null the header shows the title alone (no parentheses). */
  year: number | null
  /** Current Notes value from the parent form. */
  value: string
  /** Apply the edited buffer back to the parent form field (does not persist to the DB). */
  onSave: (next: string) => void
  /** Close + discard the buffer (Cancel). */
  onClose: () => void
}

const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard

/**
 * Full-screen editor for a long Notes field. A **buffered** editor: it edits a local copy and only
 * `onSave` writes it back to the parent form (the form's own Save then persists). Reuses the shared
 * `EntryHeaderActions` cluster — Delete clears the text (two-step confirm), Reset reverts to the value
 * at open, Save applies + closes — with a top-left X to Cancel (discard). Local overlay (not a route),
 * modelled on `Calendar`.
 */
export function NotesEditorModal({
  title,
  year,
  value,
  onSave,
  onClose,
}: NotesEditorModalProps) {
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
    : 'Notes'
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
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit notes"
        className="absolute inset-0 flex flex-col bg-surface pt-[env(safe-area-inset-top)] motion-reduce:animate-none animate-[slideUp_200ms_ease-out]"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={onClose} aria-label="Close" className="text-text-secondary">
            <IconX size={22} />
          </button>
          <h1 className="flex-1 truncate text-[17px] font-medium text-text-primary">
            {headerTitle}
          </h1>
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
            <span className="text-xs text-text-secondary">Notes</span>
            {canPaste && (
              <button
                onClick={() => void pasteAtCursor()}
                className="flex items-center gap-1 text-xs text-accent"
              >
                <IconClipboard size={14} /> Paste
              </button>
            )}
          </div>
          <textarea
            ref={taRef}
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            className="mt-1 w-full flex-1 resize-none overflow-y-auto rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
