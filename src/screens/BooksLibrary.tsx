import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconBook } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useSessionState } from '../hooks/useSessionState'
import { useBooksVersion, bumpBooks } from '../lib/books-refresh'
import { deleteBook, listBooks, updateBook } from '../data/book'
import { BOOK_STATUSES, type BookStatus, BOOK_STATUS_LABELS } from '../constants/books'
import { LGBTQ_REPS, LGBTQ_REP_LABELS } from '../constants/lgbtq'
import { DYNASTIES } from '../constants/dynasty'
import {
  applyLibraryView,
  bookGenres,
  DEFAULT_LIBRARY_CRITERIA,
  type LibraryCriteria,
  type SortField,
} from '../lib/books'
import { todayLocal, type IsoDate } from '../lib/date'
import { routes } from '../constants/routes'
import { ListRow } from '../components/ListRow'
import { SelectMenu } from '../components/SelectMenu'
import { Toggle } from '../components/Toggle'
import { Calendar } from '../components/Calendar'
import { ListSearchFilterPanel, ResultCount } from '../components/ListSearchFilterPanel'
import { DateRangeRow } from '../components/DateRangeRow'
import { BookRowHeader } from '../components/BookRowHeader'
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
  const [criteria, setCriteria] = useSessionState<LibraryCriteria>(
    'wellworth:books-library',
    DEFAULT_LIBRARY_CRITERIA,
  )
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

  // Optimistic delete: drop the row locally so it disappears instantly, instead of waiting for a
  // `bumpBooks()` → full-library refetch. Override resets when a real fetch lands (adjust-state-
  // during-render, not an effect — see tech-spec F16b).
  const [override, setOverride] = useState<typeof books>(undefined)
  const [syncedBooks, setSyncedBooks] = useState(books)
  if (syncedBooks !== books) {
    setSyncedBooks(books)
    setOverride(undefined)
  }

  async function remove(id: string) {
    setOverride((prev) => (prev ?? books ?? []).filter((b) => b.id !== id))
    try {
      await deleteBook(id)
    } catch {
      bumpBooks() // resync from server on a failed delete
    }
  }

  async function toggleFavorite(id: string, next: boolean) {
    setOverride((prev) =>
      (prev ?? books ?? []).map((b) => (b.id === id ? { ...b, is_favorite: next } : b)),
    )
    try {
      await updateBook(id, { is_favorite: next })
    } catch {
      bumpBooks() // resync from server on a failed write
    }
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
    setCriteria(() => ({
      ...DEFAULT_LIBRARY_CRITERIA,
      //query: c.query,
      //sortField: c.sortField,
      //sortDir: c.sortDir,
    }))
  }

  const allBooks = override ?? books ?? []
  const genreOptions = [
    { value: 'all', label: 'Any Genre' },
    ...bookGenres(allBooks).map((g) => ({ value: g, label: g })),
  ]
  const boundValue: Record<DateBound, IsoDate | null> = {
    startFrom: criteria.startFrom,
    startTo: criteria.startTo,
    endFrom: criteria.endFrom,
    endTo: criteria.endTo,
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <ListSearchFilterPanel
        sticky
        query={criteria.query}
        onQueryChange={(q) => setCrit({ query: q })}
        placeholder="Search title, author"
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        sortField={criteria.sortField}
        sortOptions={SORT_OPTIONS}
        onSortFieldChange={(f) => setCrit({ sortField: f })}
        sortDir={criteria.sortDir}
        onToggleSortDir={() =>
          setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
        }
        onClearFilters={clearFilters}
        hasActiveFilters={
          JSON.stringify(criteria) !== JSON.stringify(DEFAULT_LIBRARY_CRITERIA)
        }
        extra={
          <span className="flex items-center gap-1.5">
            <span className="text-caption text-text-secondary">Favorites Only</span>
            <Toggle
              checked={criteria.favoritesOnly}
              onChange={(v) => setCrit({ favoritesOnly: v })}
              label="Favorites Only"
            />
          </span>
        }
        filters={
          <>
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
          </>
        }
        loading={loading}
        error={error}
        data={override ?? books}
        errorText="Couldn’t load your books."
        emptyState={
          <EmptyState
            title="No books yet"
            actionLabel="New Book"
            to={routes.books.entry}
            Icon={IconBook}
          />
        }
      >
        {(all) => {
          const view = applyLibraryView(all, criteria)
          return (
            <>
              {view.length > 0 && <ResultCount count={view.length} />}
              <div className="flex flex-col gap-2">
                {view.length === 0 ? (
                  <p className="rounded-card border border-border bg-surface px-4 py-6 text-center text-body text-text-tertiary">
                    No matches.
                  </p>
                ) : (
                  view.map((b) => (
                    <ListRow
                      key={b.id}
                      leading={<CoverThumb url={b.cover_url} />}
                      isFavorite={b.is_favorite}
                      onToggleFavorite={() => void toggleFavorite(b.id, !b.is_favorite)}
                      onDelete={() => void remove(b.id)}
                      onClick={() => navigate(routes.books.edit(b.id))}
                    >
                      <BookRowHeader book={b} />
                    </ListRow>
                  ))
                )}
              </div>
            </>
          )
        }}
      </ListSearchFilterPanel>

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
