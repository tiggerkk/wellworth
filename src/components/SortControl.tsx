import { IconArrowDown, IconArrowUp } from '@tabler/icons-react'
import { SelectMenu } from './SelectMenu'

export type SortDir = 'asc' | 'desc'

interface SortControlProps<T extends string> {
  field: T
  /** The module's sort fields — change this array to change the dropdown (per-module, in code). */
  options: { value: T; label: string }[]
  onFieldChange: (field: T) => void
  dir: SortDir
  onToggleDir: () => void
}

/**
 * Shared "Sort" cluster — a label, the sort-field `SelectMenu`, and an asc/desc direction toggle.
 * Lives in the `FilterPanel` footer next to Clear Filters. Each module passes its own `options`
 * array, so editing a module's Sort menu is a one-line code change.
 */
export function SortControl<T extends string>({
  field,
  options,
  onFieldChange,
  dir,
  onToggleDir,
}: SortControlProps<T>) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-text-secondary">Sort</span>
      <SelectMenu
        value={field}
        options={options}
        onChange={onFieldChange}
        ariaLabel="Sort field"
        className="w-28"
      />
      <button
        onClick={onToggleDir}
        aria-label="Sort direction"
        className="rounded-input bg-input p-1.5 text-text-primary"
      >
        {dir === 'asc' ? <IconArrowUp size={15} /> : <IconArrowDown size={15} />}
      </button>
    </div>
  )
}
