interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Small centered confirm modal — themed counterpart to a native `confirm()`. First consumer is
 * `useEntryClose`'s discard-unsaved-changes prompt, but the shell is generic (not tied to entry
 * forms) in case another destructive flow wants the same pattern later. Unlike `OverlayTop` /
 * `OverlayBottom` (both anchor edge-to-edge), this is a small centered card — no Esc-to-close of its
 * own, since the underlying screen's Escape handler already drives `requestClose`.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Discard',
  cancelLabel = 'Keep Editing',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-xs rounded-card border border-border bg-surface p-4 shadow-lg"
      >
        <h2 className="text-heading font-medium text-text-primary">{title}</h2>
        <p className="mt-1 text-body text-text-secondary">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-pill border border-border bg-surface-alt px-3 py-1.5 text-body font-medium text-text-secondary transition-opacity hover:opacity-90"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-pill bg-danger px-3 py-1.5 text-body font-medium text-bg transition-opacity hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
