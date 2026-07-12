import { SearchBar } from './SearchBar'
import { FilterToggleButton } from './FilterToggleButton'

interface ListSearchHeaderProps {
  /** Current search text — the screen owns this in its `criteria.query` field. */
  query: string
  onQueryChange: (query: string) => void
  /** Forwarded to `SearchBar` — keep it specific per module, e.g. "Search title, author". */
  placeholder: string
  /** Whether the `FilterPanel` below is currently open — tints the Filter icon. */
  filtersOpen: boolean
  onToggleFilters: () => void
  /** Applied to the root row. Override only for one-off spacing (defaults cover every module). */
  className?: string
}

/**
 * The Search + Filter-toggle row shared by every module's Library/Reports/Trips list
 * (Insurance, Quotes, Poems, Shows, Books, Trips, Reports). Previously each screen hand-assembled
 * this row from `SearchBar` + `FilterToggleButton` with identical markup; centralizing it here
 * means a layout change (e.g. moving the Filter icon, adding a scan button) is a one-file edit
 * instead of seven.
 *
 * This component intentionally owns ONLY the row itself — not the sticky/backdrop wrapper some
 * screens (Quotes, Books, Shows, Literature) place around it, and not the `{!error && ...}` guard
 * some screens (Insurance, Medical) use to hide it on load failure. Those wrapping decisions stay
 * in each screen, since they vary by module and aren't part of the search/filter/sort concern.
 */
export function ListSearchHeader({
  query,
  onQueryChange,
  placeholder,
  filtersOpen,
  onToggleFilters,
  className = 'flex items-center gap-2',
}: ListSearchHeaderProps) {
  return (
    <div className={className}>
      <SearchBar
        value={query}
        onChange={onQueryChange}
        placeholder={placeholder}
        className="min-w-0 flex-1"
      />
      <FilterToggleButton active={filtersOpen} onClick={onToggleFilters} />
    </div>
  )
}
