import { IconTrash } from '@tabler/icons-react'

/**
 * Small muted trash-icon button for removing one row from an in-progress list (e.g. a serving
 * size row on the Add/Edit Food forms). Deliberately more muted (`text-text-tertiary`) than
 * `IconAction`'s `secondary` tone — this removes a just-added draft row, not a persisted record.
 */
export function RemoveRowButton({
  onClick,
  label = 'Remove',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button onClick={onClick} aria-label={label} className="shrink-0 text-text-tertiary">
      <IconTrash size={18} />
    </button>
  )
}
