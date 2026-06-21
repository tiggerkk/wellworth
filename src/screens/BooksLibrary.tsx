import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  IconArrowDown,
  IconArrowUp,
  IconFilter,
  IconHeartFilled,
  IconX,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useBooksVersion, bumpBooks } from '../lib/books-refresh'
import { deleteBook, listBooks } from '../data/book'
import {
  applyLibraryView,
  bookAuthors,
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
import { formatDayLabel, todayLocal, type IsoDate } from '../lib/date'
import { routes } from '../constants/routes'
import { SearchBar } from '../components/SearchBar'
import { SwipeRow } from '../components/SwipeRow'
import { SelectMenu } from '../components/SelectMenu'
import { Toggle } from '../components/Toggle'
import { Calendar } from '../components/Calendar'
import { StatusChip } from '../components/StatusChip'
import { StarRating } from '../components/StarRating'
import { CoverThumb } from '../components/CoverThumb'

type StatusFilter = 'all' | BookStatus
type DateBound = 'startFrom' | 'startTo' | 'endFrom' | 'endTo'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...BOOK_STATUSES.map((s) => ({ value: s, label: BOOK_STATUS_LABELS[s] })),
]
const LGBTQ_OPTIONS = [
  { value: 'all' as const, label: 'Any LGBT+' },
  ...LGBTQ_REPS.map((r) => ({ value: r, label: LGBTQ_REP_LABELS[r] })),
]
const RATING_OPTIONS = [
  { value: '0', label: 'Any rating' },
  { value: '1', label: '1★+' },
  { value: '2', label: '2★+' },
  { value: '3', label: '3★+' },
  { value: '4', label: '4★+' },
  { value: '5', label: '5★' },
]
const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'year', label: 'Year' },
  { value: 'status', label: 'Status' },
  { value: 'rating', label: 'Rating' },
  { value: 'genre', label: 'Genre' },
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
    { value: 'all', label: 'All genres' },
    ...bookGenres(allBooks).map((g) => ({ value: g, label: g })),
  ]
  const authorOptions = [
    { value: 'all', label: 'All authors' },
    ...bookAuthors(allBooks).map((a) => ({ value: a, label: a })),
  ]
  const view = applyLibraryView(allBooks, criteria)

  const activeCount =
    (criteria.genre !== 'all' ? 1 : 0) +
    (criteria.author !== 'all' ? 1 : 0) +
    (criteria.minRating > 0 ? 1 : 0) +
    (criteria.lgbtq !== 'all' ? 1 : 0) +
    (criteria.status !== 'all' ? 1 : 0) +
    (criteria.favoritesOnly ? 1 : 0) +
    (criteria.startFrom || criteria.startTo ? 1 : 0) +
    (criteria.endFrom || criteria.endTo ? 1 : 0)

  const boundValue: Record<DateBound, IsoDate | null> = {
    startFrom: criteria.startFrom,
    startTo: criteria.startTo,
    endFrom: criteria.endFrom,
    endTo: criteria.endTo,
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <SearchBar
          value={criteria.query}
          onChange={(q) => setCrit({ query: q })}
          placeholder="Search title, author"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex items-center gap-1 rounded-input bg-input px-2.5 py-1.5 text-sm text-text-primary"
          >
            <IconFilter size={15} /> Filters
            {activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-xs text-text-secondary">Sort</span>
            <SelectMenu
              value={criteria.sortField}
              options={SORT_OPTIONS}
              onChange={(f) => setCrit({ sortField: f })}
              ariaLabel="Sort field"
              className="w-24"
            />
            <button
              onClick={() =>
                setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
              }
              aria-label="Sort direction"
              className="rounded-input bg-input p-1.5 text-text-primary"
            >
              {criteria.sortDir === 'asc' ? (
                <IconArrowUp size={15} />
              ) : (
                <IconArrowDown size={15} />
              )}
            </button>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <SelectMenu
                value={criteria.status}
                options={STATUS_OPTIONS}
                onChange={(s) => setCrit({ status: s })}
              />
            </Field>
            <Field label="Genre">
              <SelectMenu
                value={criteria.genre}
                options={genreOptions}
                onChange={(g) => setCrit({ genre: g })}
              />
            </Field>
            <Field label="Rating">
              <SelectMenu
                value={String(criteria.minRating)}
                options={RATING_OPTIONS}
                onChange={(v) => setCrit({ minRating: Number(v) })}
              />
            </Field>
            <Field label="LGBT+">
              <SelectMenu
                value={criteria.lgbtq}
                options={LGBTQ_OPTIONS}
                onChange={(l) => setCrit({ lgbtq: l })}
              />
            </Field>
            <Field label="Author">
              <SelectMenu
                value={criteria.author}
                options={authorOptions}
                onChange={(a) => setCrit({ author: a })}
              />
            </Field>
            <label className="flex items-center justify-between self-end py-1.5">
              <span className="text-text-secondary">Favourites only</span>
              <Toggle
                checked={criteria.favoritesOnly}
                onChange={(v) => setCrit({ favoritesOnly: v })}
                label="Favourites only"
              />
            </label>
          </div>
          <DateRange
            label="Started between"
            from={criteria.startFrom}
            to={criteria.startTo}
            onPickFrom={() => setWhichDate('startFrom')}
            onPickTo={() => setWhichDate('startTo')}
            onClearFrom={() => setBound('startFrom', null)}
            onClearTo={() => setBound('startTo', null)}
          />
          <DateRange
            label="Finished between"
            from={criteria.endFrom}
            to={criteria.endTo}
            onPickFrom={() => setWhichDate('endFrom')}
            onPickTo={() => setWhichDate('endTo')}
            onClearFrom={() => setBound('endFrom', null)}
            onClearTo={() => setBound('endTo', null)}
          />
          {activeCount > 0 && (
            <button onClick={clearFilters} className="self-start text-accent">
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && <p className="px-1 py-6 text-sm text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-1 py-6 text-sm text-danger">Couldn’t load your books.</p>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          {view.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-tertiary">
              {allBooks.length > 0 ? 'No matches.' : 'No books yet — add one.'}
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
                            {formatDayLabel((b.end_date ?? b.last_update_date)!)}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-text-secondary">{label}</p>
      {children}
    </div>
  )
}

function DateRange({
  label,
  from,
  to,
  onPickFrom,
  onPickTo,
  onClearFrom,
  onClearTo,
}: {
  label: string
  from: IsoDate | null
  to: IsoDate | null
  onPickFrom: () => void
  onPickTo: () => void
  onClearFrom: () => void
  onClearTo: () => void
}) {
  return (
    <div>
      <p className="mb-1 text-text-secondary">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <DateButton
          value={from}
          placeholder="From"
          onPick={onPickFrom}
          onClear={onClearFrom}
        />
        <DateButton value={to} placeholder="To" onPick={onPickTo} onClear={onClearTo} />
      </div>
    </div>
  )
}

function DateButton({
  value,
  placeholder,
  onPick,
  onClear,
}: {
  value: IsoDate | null
  placeholder: string
  onPick: () => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPick}
        className="min-w-0 flex-1 truncate rounded-input bg-input px-2 py-1.5 text-left text-text-primary"
      >
        {value ? (
          formatDayLabel(value)
        ) : (
          <span className="text-text-tertiary">{placeholder}</span>
        )}
      </button>
      {value && (
        <button onClick={onClear} aria-label="Clear date" className="text-text-tertiary">
          <IconX size={14} />
        </button>
      )}
    </div>
  )
}
