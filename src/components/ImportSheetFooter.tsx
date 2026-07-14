import { PrimaryButton } from './PrimaryButton'

interface ImportSheetFooterProps {
  count: number
  importing: boolean
  disabled?: boolean
  onSubmit: () => void
  submitLabel: (count: number) => string
  emptyLabel?: string
  importingLabel?: string
  /**
   * Presence (not value) signals completion — shapes vary per sheet
   * ({created, updated}, DoneStats, plain number, etc). Pass whatever
   * your done-state holds; only nullness is checked.
   */
  done?: unknown
  onDone?: () => void
  doneLabel?: string
}

export function ImportSheetFooter({
  count,
  importing,
  disabled = false,
  onSubmit,
  submitLabel,
  emptyLabel = 'IMPORT',
  importingLabel = 'Importing…',
  done,
  onDone,
  doneLabel = 'DONE',
}: ImportSheetFooterProps) {
  return (
    <div className="border-t border-border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      {done != null && onDone ? (
        <PrimaryButton onClick={onDone} className="w-full">
          {doneLabel}
        </PrimaryButton>
      ) : (
        <PrimaryButton
          onClick={onSubmit}
          disabled={importing || disabled || count === 0}
          className="w-full"
        >
          {importing ? importingLabel : count > 0 ? submitLabel(count) : emptyLabel}
        </PrimaryButton>
      )}
    </div>
  )
}
