import type { ReactNode } from 'react'
import { SortControl, type SortDir } from './SortControl'

interface FilterPanelFooterProps<T extends string> {
  sortField: T
  /** The module's sort fields — same array each screen already builds as `SORT_OPTIONS`. */
  sortOptions: { value: T; label: string }[]
  onSortFieldChange: (field: T) => void
  sortDir: SortDir
  onToggleSortDir: () => void
  /** "Sort" in English modules, "排序" in Literature — forwarded to `SortControl`. */
  sortLabel?: string
  onClearFilters: () => void
  /** "Clear Filters" in English modules, "清除篩選" in Literature. */
  clearLabel?: string
  /**
   * Extra controls rendered to the left of Sort, inside the same group (e.g. Literature's
   * "只看收藏" Favorites toggle, which shares this row instead of living in the grid above).
   * Omit for the standard Sort-only footer used by Insurance, Quotes, Shows, Books, Trips, Reports.
   */
  leading?: ReactNode
}

/**
 * The Sort + Clear Filters row that sits at the bottom of every module's `FilterPanel`
 * (Insurance, Quotes, Poems, Shows, Books, Trips, Reports). This was the single most-duplicated
 * block in the codebase — byte-for-byte identical across six modules and only Chinese-localized
 * in Literature. Centralizing it here means:
 *   - moving Sort to always be visible under the search bar (see chat) becomes a one-file change
 *   - restyling "Clear Filters" (e.g. turning it into an icon button) is a one-file change
 *   - any new module gets the correct behavior for free by importing this instead of copy-pasting
 *
 * `flex-wrap` + `gap-3` (rather than the old plain `flex items-center justify-between`) is a
 * no-op for the six simple-footer modules — with only two children spread by `justify-between`
 * there's nothing to wrap — but it's what lets Literature's `leading` toggle share the row
 * without a layout override.
 */
export function FilterPanelFooter<T extends string>({
  sortField,
  sortOptions,
  onSortFieldChange,
  sortDir,
  onToggleSortDir,
  sortLabel,
  onClearFilters,
  clearLabel = 'Clear Filters',
  leading,
}: FilterPanelFooterProps<T>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {leading}
        <SortControl
          field={sortField}
          options={sortOptions}
          onFieldChange={onSortFieldChange}
          dir={sortDir}
          onToggleDir={onToggleSortDir}
          label={sortLabel}
        />
      </div>
      <button onClick={onClearFilters} className="text-accent">
        {clearLabel}
      </button>
    </div>
  )
}
