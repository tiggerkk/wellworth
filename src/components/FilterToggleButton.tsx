import { IconFilter } from '@tabler/icons-react'

interface FilterToggleButtonProps {
  /** Whether the filter panel is open — tints the icon accent when true. */
  active: boolean
  onClick: () => void
}

/**
 * Icon-only Filter toggle shared by every module's Library/Reports/Trips header. Mirrors the
 * original Travel design: a bare `IconFilter` that turns accent while its panel is open. Place it to
 * the right of the `SearchBar` (Shows/Books/Quotes/Medical) or on its own row (Travel).
 */
export function FilterToggleButton({ active, onClick }: FilterToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Filters"
      className={`shrink-0 rounded-input p-2 ${active ? 'text-accent' : 'text-text-secondary'}`}
    >
      <IconFilter size={20} />
    </button>
  )
}
