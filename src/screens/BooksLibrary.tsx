import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconHeartFilled } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useBooksVersion, bumpBooks } from '../lib/books-refresh'
import { deleteBook, listBooks } from '../data/book'
import {
  applyLibraryView,
  bookGenres,
  BOOK_STATUS_CHIP,
  BOOK_STATUS_LABELS,
  BOOK_STATUSES,
  DEFAULT_LIBRARY_CRITERIA,
  LGBTQ_REP_LABELS,
  LGBTQ_REPS,
  type BookStatus,
  type LibraryCriteria,
  type SortField,
} from '../lib/books'
import { DYNASTIES, DYNASTY_CHIP } from '../constants/dynasty'
import { formatMonthDay, todayLocal, type IsoDate } from '../lib/date'
import { routes } from '../constants/routes'
import { SearchBar } from '../components/SearchBar'
import { SwipeRow } from '../components/SwipeRow'
import { SelectMenu } from '../components/SelectMenu'
import { Toggle } from '../components/Toggle'
import { Calendar } from '../components/Calendar'
import { FilterToggleButton } from '../components/FilterToggleButton'
import { FilterPanel } from '../components/FilterPanel'
import { SortControl } from '../components/SortControl'
import { DateRangeRow } from '../components/DateRangeRow'
import { StatusChip } from '../components/StatusChip'
import { StarRating } from '../components/StarRating'
import { CoverThumb } from '../components/CoverThumb'
import { EmptyState } from '../components/EmptyState'

type StatusFilter = 'all' | BookStatus
type DateBound = 'startFrom' | 'startTo' | 'endFrom' | 'endTo'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Any Status' },
  ...BOOK_STATUSES.map((s) => ({ value: s, label: BOOK_STATUS_LABELS[s] })),
]
const LGBTQ_OPTIONS = [
  { value: 'all' as const, label: 'Any LGBT+' },
  ...LGBTQ_REPS.map((r) => ({ value: r, label: LGBTQ_REP_LABELS[r] })),
]
const DYNASTY_OPTIONS = [
  { value: 'all' as const, label: 'Any Dynasty' },
  ...DYNASTIES.map((d) => ({ value: d, label: d })),
]
const RATING_OPTIONS = [
  { value: '0', label: 'Any Rating' },
  { value: '1', label: '1★+' },
  { value: '2', label: '2★+' },
  { value: '3', label: '3★+' },
  { value: '4', label: '4★+' },
  { value: '5', label: '5★' },
]
const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'dynasty', label: 'Dynasty' },
  { value: 'rating', label: 'Rating' },
  { value: 'status', label: 'Status' },
  { value: 'genre', label: 'Genre' },
  { value: 'author', label: 'Author' },
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
]

/**
 * Books — Library. Cover-thumbnail list with search (title/author), a collapsible filter panel
 * (Status/Genre/Rating/LGBT+/Author + start & finish date ranges) and a Sort menu. All
 * filtering/sorting is the pure `applyLibraryView`; this screen just holds the criteria state.
 */
export function BooksLibrary() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useBooksVersion()
  const [criteria, setCriteria] = useState<LibraryCriteria>(DEFAULT_LIBRARY_CRITERIA)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [whichDate, setWhichDate] = useState<DateBound | null>(null)

  const setCrit = (patch: Partial<LibraryCriteria>) =>
    setCriteria((c) => ({ ...c, ...patch }))

  const fn = useCallback(() => {
    void version // refetch after a create/edit/delete (bumpBooks)
    if (!userId) return Promise.resolve([])
    return listBooks(userId)
  }, [userId, version])
  const { data: books, loading, error } = useAsync(fn)

  async function remove(id: string, title: string) {
    if (!confirm(`Delete “${title}”? This can’t be undone.`)) return
    await deleteBook(id)
    bumpBooks()
  }

  function setBound(which: DateBound, d: IsoDate | null) {
    setCriteria((c) => ({
      ...c,
      startFrom: which === 'startFrom' ? d : c.startFrom,
      startTo: which === 'startTo' ? d : c.startTo,
      endFrom: which === 'endFrom' ? d : c.endFrom,
      endTo: which === 'endTo' ? d : c.endTo,
    }))
  }

  function clearFilters() {
    setCriteria((c) => ({
      ...DEFAULT_LIBRARY_CRITERIA,
      query: c.query,
      sortField: c.sortField,
      sortDir: c.sortDir,
    }))
  }

  const allBooks = books ?? []
  const genreOptions = [
    { value: 'all', label: 'Any Genre' },
    ...bookGenres(allBooks).map((g) => ({ value: g, label: g })),
  ]
  const view = applyLibraryView(allBooks, criteria)

  const boundValue: Record<DateBound, IsoDate | null> = {
    startFrom: criteria.startFrom,
    startTo: criteria.startTo,
    endFrom: criteria.endFrom,
    endTo: criteria.endTo,
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <SearchBar
            value={criteria.query}
            onChange={(q) => setCrit({ query: q })}
            placeholder="Search title, author"
            className="min-w-0 flex-1"
          />
          <FilterToggleButton
            active={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          />
        </div>
      </div>

      {filtersOpen && (
        <FilterPanel>
          <div className="grid grid-cols-2 gap-3">
            <SelectMenu
              value={criteria.status}
              options={STATUS_OPTIONS}
              onChange={(s) => setCrit({ status: s })}
            />
            <SelectMenu
              value={criteria.genre}
              options={genreOptions}
              onChange={(g) => setCrit({ genre: g })}
            />
            <SelectMenu
              value={String(criteria.minRating)}
              options={RATING_OPTIONS}
              onChange={(v) => setCrit({ minRating: Number(v) })}
            />
            <SelectMenu
              value={criteria.lgbtq}
              options={LGBTQ_OPTIONS}
              onChange={(l) => setCrit({ lgbtq: l })}
            />
            <SelectMenu
              value={criteria.dynasty}
              options={DYNASTY_OPTIONS}
              onChange={(d) => setCrit({ dynasty: d })}
            />
            <label className="flex items-center justify-between self-end py-1.5">
              <span className="text-text-secondary">Favorites Only</span>
              <Toggle
                checked={criteria.favoritesOnly}
                onChange={(v) => setCrit({ favoritesOnly: v })}
                label="Favorites Only"
              />
            </label>
          </div>
          <DateRangeRow
            label="Started"
            from={criteria.startFrom}
            to={criteria.startTo}
            onPickFrom={() => setWhichDate('startFrom')}
            onPickTo={() => setWhichDate('startTo')}
            onClearFrom={() => setBound('startFrom', null)}
            onClearTo={() => setBound('startTo', null)}
          />
          <DateRangeRow
            label="Finished"
            from={criteria.endFrom}
            to={criteria.endTo}
            onPickFrom={() => setWhichDate('endFrom')}
            onPickTo={() => setWhichDate('endTo')}
            onClearFrom={() => setBound('endFrom', null)}
            onClearTo={() => setBound('endTo', null)}
          />
          <div className="flex items-center justify-between">
            <SortControl
              field={criteria.sortField}
              options={SORT_OPTIONS}
              onFieldChange={(f) => setCrit({ sortField: f })}
              dir={criteria.sortDir}
              onToggleDir={() =>
                setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
              }
            />
            <button onClick={clearFilters} className="text-accent">
              Clear Filters
            </button>
          </div>
        </FilterPanel>
      )}

      {loading && <p className="px-1 py-6 text-sm text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-1 py-6 text-sm text-danger">Couldn’t load your books.</p>
      )}

      {!loading && !error && allBooks.length === 0 && (
        <EmptyState title="No books yet" actionLabel="New Book" to={routes.books.entry} />
      )}

      {!loading && !error && allBooks.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          {view.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-tertiary">
              No matches.
            </p>
          ) : (
            view.map((b) => (
              <SwipeRow key={b.id} onDelete={() => void remove(b.id, b.title)}>
                <button
                  onClick={() => navigate(routes.books.edit(b.id))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
                >
                  <CoverThumb url={b.cover_url} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[15px] text-text-primary">
                      {b.is_favorite && (
                        <IconHeartFilled
                          size={13}
                          className="shrink-0 text-accent"
                          aria-label="Favourite"
                        />
                      )}
                      <span className="min-w-0 truncate">
                        {b.title}
                        {b.year ? ` (${b.year})` : ''}
                      </span>
                      {b.dynasty && (
                        <StatusChip
                          label={b.dynasty}
                          className={`shrink-0 ${DYNASTY_CHIP}`}
                        />
                      )}
                    </span>
                    {b.authors?.length ? (
                      <span className="block truncate text-xs text-text-secondary">
                        {b.authors.join(', ')}
                      </span>
                    ) : null}
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                      <StatusChip
                        label={BOOK_STATUS_LABELS[b.status as BookStatus]}
                        className={BOOK_STATUS_CHIP[b.status as BookStatus]}
                      />
                      {b.rating ? <StarRating value={b.rating} size={13} /> : null}
                    </span>
                    {(b.genres?.[0] || b.end_date || b.last_update_date) && (
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
                        {b.genres?.[0] && <span>{b.genres[0]}</span>}
                        {(b.end_date ?? b.last_update_date) && (
                          <span>
                            {formatMonthDay((b.end_date ?? b.last_update_date)!)}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </button>
              </SwipeRow>
            ))
          )}
        </div>
      )}

      {whichDate && (
        <Calendar
          day={boundValue[whichDate] ?? todayLocal()}
          onSelect={(d) => {
            setBound(whichDate, d)
            setWhichDate(null)
          }}
          onClose={() => setWhichDate(null)}
        />
      )}
    </div>
  )
}
