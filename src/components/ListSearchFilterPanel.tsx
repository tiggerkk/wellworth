import type { ReactNode } from 'react'
import {
  IconArrowDown,
  IconArrowUp,
  IconFilter,
  IconFilterFilled,
  IconFilterX,
  IconSortDescending2,
} from '@tabler/icons-react'
import { SearchBar } from './SearchBar'
import { SelectMenu } from './SelectMenu'

export type SortDir = 'asc' | 'desc'

/** Small muted "N results" line — the screen renders this itself once it has the filtered view. */
export function ResultCount({
  count,
  className = '',
}: {
  count: number
  className?: string
}) {
  return (
    <p className={`px-1 text-caption text-text-secondary ${className}`}>
      {count} {count === 1 ? 'result' : 'results'}
    </p>
  )
}

interface ListSearchFilterPanelProps<T, F extends string> {
  /** Rendered above the search row, inside the same sticky/flat wrapper (e.g. Shows' SegmentedTabs). */
  topExtra?: ReactNode
  query: string
  onQueryChange: (query: string) => void
  placeholder: string
  filtersOpen: boolean
  onToggleFilters: () => void
  /** Rendered after the search/sort chrome, before the filter panel body (e.g. Quotes' constraint banner). */
  afterSearch?: ReactNode
  /** Filter-panel body (dropdowns/pills/date rows) — rendered while `filtersOpen`. */
  filters?: ReactNode
  sortField: F
  sortOptions: { value: F; label: string }[]
  onSortFieldChange: (field: F) => void
  sortDir: SortDir
  onToggleSortDir: () => void
  onClearFilters: () => void
  /** Whether the search box or any filter differs from its default — gates Clear Filters, matching
   *  EntryHeaderActions' Reset button (disabled + dimmed until there's something to reset). */
  hasActiveFilters: boolean
  /** Rendered right after the sort direction toggle, before Clear Filters — e.g. Favorites Only. */
  extra?: ReactNode
  /** Sticks the search/sort chrome to the top with a blurred background. */
  sticky?: boolean
  /** Hides the search row entirely (e.g. Insurance/Medical on load error). */
  hideSearch?: boolean
  /** Hides the sort/clear footer + filter panel body (e.g. Insurance/Medical before any items exist). */
  hideFilters?: boolean
  loading: boolean
  error?: unknown
  data: T[] | null | undefined
  errorText: ReactNode
  /** Text shown while `loading` (default "Loading…"; Literature passes "載入中…"). */
  loadingText?: ReactNode
  emptyState: ReactNode
  children: (data: T[]) => ReactNode
}

/**
 * The Search + Filter-toggle + Sort/Clear + list-loading chrome shared by every listing screen
 * (Books, Shows, Quotes, Insurance, Trips, Medical Reports, Poems, Wellness Foods/Activities).
 */
export function ListSearchFilterPanel<T, F extends string>({
  topExtra,
  query,
  onQueryChange,
  placeholder,
  filtersOpen,
  onToggleFilters,
  afterSearch,
  filters,
  sortField,
  sortOptions,
  onSortFieldChange,
  sortDir,
  onToggleSortDir,
  onClearFilters,
  hasActiveFilters,
  extra,
  sticky = false,
  hideSearch = false,
  hideFilters = false,
  loading,
  error,
  data,
  errorText,
  loadingText = 'Loading…',
  emptyState,
  children,
}: ListSearchFilterPanelProps<T, F>) {
  const all = data ?? []

  const searchRow = !hideSearch && (
    <div className="flex items-center gap-2">
      <SearchBar
        value={query}
        onChange={onQueryChange}
        placeholder={placeholder}
        className="min-w-0 flex-1"
      />
      <button
        onClick={onToggleFilters}
        aria-label="Filters"
        aria-pressed={filtersOpen}
        className={`shrink-0 rounded-input p-2 ${filtersOpen ? 'text-accent' : 'text-text-secondary'}`}
      >
        {filtersOpen ? <IconFilterFilled size={20} /> : <IconFilter size={20} />}
      </button>
    </div>
  )

  const sortFooterRow = !hideFilters && (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <IconSortDescending2 size={17} className="shrink-0 text-text-secondary" />
        <SelectMenu
          value={sortField}
          options={sortOptions}
          onChange={onSortFieldChange}
          ariaLabel="Sort field"
          className="w-28"
        />
        <button
          onClick={onToggleSortDir}
          aria-label="Sort direction"
          className="rounded-input bg-input p-1.5 text-text-primary"
        >
          {sortDir === 'asc' ? <IconArrowUp size={15} /> : <IconArrowDown size={15} />}
        </button>
        {extra}
      </div>
      <button
        onClick={onClearFilters}
        disabled={!hasActiveFilters}
        aria-label="Clear Filters"
        className="shrink-0 rounded-input p-2 text-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:text-text-tertiary disabled:opacity-40"
      >
        <IconFilterX size={20} />
      </button>
    </div>
  )

  return (
    <>
      {sticky ? (
        <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
          {topExtra}
          {searchRow}
          {sortFooterRow}
        </div>
      ) : (
        <>
          {topExtra}
          {searchRow}
          {sortFooterRow}
        </>
      )}

      {afterSearch}

      {filtersOpen && !hideFilters && filters && (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 text-caption">
          {filters}
        </div>
      )}

      {loading && (
        <p className="px-4 py-6 text-body text-text-secondary">{loadingText}</p>
      )}
      {error && <p className="px-4 py-6 text-body text-danger">{errorText}</p>}
      {!loading && !error && all.length === 0 && emptyState}
      {!loading && !error && all.length > 0 && children(all)}
    </>
  )
}
