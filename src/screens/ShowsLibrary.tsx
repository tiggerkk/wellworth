import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  IconArrowDown,
  IconArrowUp,
  IconFilter,
  IconPlus,
  IconSettings,
  IconX,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useShowsVersion, bumpShows } from '../lib/shows-refresh'
import { deleteShow, listShows } from '../data/show'
import {
  applyLibraryView,
  DEFAULT_LIBRARY_CRITERIA,
  LGBTQ_REP_LABELS,
  LGBTQ_REPS,
  SHOW_STATUS_LABELS,
  SHOW_STATUSES,
  showGenres,
  type LibraryCriteria,
  type ShowStatus,
  type ShowType,
  type SortField,
} from '../lib/shows'
import { formatDayLabel, todayLocal, type IsoDate } from '../lib/date'
import { routes } from '../constants/routes'
import { SearchBar } from '../components/SearchBar'
import { SwipeRow } from '../components/SwipeRow'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SelectMenu } from '../components/SelectMenu'
import { Calendar } from '../components/Calendar'
import { ShowTypeBadge } from '../components/ShowTypeBadge'
import { StatusChip } from '../components/StatusChip'
import { StarRating } from '../components/StarRating'
import { PosterThumb } from '../components/PosterThumb'

type TypeFilter = 'all' | ShowType
type StatusFilter = 'all' | ShowStatus
type DateBound = 'startFrom' | 'startTo' | 'endFrom' | 'endTo'

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tv', label: 'TV' },
  { value: 'movie', label: 'Movies' },
]
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...SHOW_STATUSES.map((s) => ({ value: s, label: SHOW_STATUS_LABELS[s] })),
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
  { value: 'type', label: 'Type' },
  { value: 'year', label: 'Year' },
  { value: 'status', label: 'Status' },
  { value: 'rating', label: 'Rating' },
  { value: 'genre', label: 'Genre' },
]

/**
 * Shows — Library. Poster-thumbnail list with search (title/director/cast), a collapsible filter
 * panel (Type/Genre/Rating/LGBT+/Status + start & finish date ranges) and a Sort menu. All
 * filtering/sorting is the pure `applyLibraryView`; this screen just holds the criteria state.
 */
export function ShowsLibrary() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useShowsVersion()
  const [criteria, setCriteria] = useState<LibraryCriteria>(DEFAULT_LIBRARY_CRITERIA)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [whichDate, setWhichDate] = useState<DateBound | null>(null)

  const setCrit = (patch: Partial<LibraryCriteria>) =>
    setCriteria((c) => ({ ...c, ...patch }))

  const fn = useCallback(() => {
    void version // refetch after a create/edit/delete (bumpShows)
    if (!userId) return Promise.resolve([])
    return listShows(userId)
  }, [userId, version])
  const { data: shows, loading, error } = useAsync(fn)

  async function remove(id: string, title: string) {
    if (!confirm(`Delete “${title}”? This can’t be undone.`)) return
    await deleteShow(id)
    bumpShows()
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

  const allShows = shows ?? []
  const genreOptions = [
    { value: 'all', label: 'All genres' },
    ...showGenres(allShows).map((g) => ({ value: g, label: g })),
  ]
  const view = applyLibraryView(allShows, criteria)

  const activeCount =
    (criteria.type !== 'all' ? 1 : 0) +
    (criteria.genre !== 'all' ? 1 : 0) +
    (criteria.minRating > 0 ? 1 : 0) +
    (criteria.lgbtq !== 'all' ? 1 : 0) +
    (criteria.status !== 'all' ? 1 : 0) +
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
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium text-text-primary">Library</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(routes.shows.entry)}
              className="flex items-center gap-1 text-sm text-positive"
            >
              <IconPlus size={16} /> New Show
            </button>
            <Link
              to={routes.shows.settings}
              aria-label="Shows settings"
              className="p-1 text-text-secondary"
            >
              <IconSettings size={18} />
            </Link>
          </div>
        </div>
        <SearchBar
          value={criteria.query}
          onChange={(q) => setCrit({ query: q })}
          placeholder="Search title, director, cast"
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
          <div>
            <p className="mb-1 text-text-secondary">Type</p>
            <SegmentedTabs
              value={criteria.type}
              onChange={(t) => setCrit({ type: t })}
              options={TYPE_OPTIONS}
            />
          </div>
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
        <p className="px-1 py-6 text-sm text-danger">Couldn’t load your shows.</p>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          {view.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-tertiary">
              {allShows.length > 0 ? 'No matches.' : 'No shows yet — add one.'}
            </p>
          ) : (
            view.map((s) => (
              <SwipeRow key={s.id} onDelete={() => void remove(s.id, s.title)}>
                <button
                  onClick={() => navigate(routes.shows.edit(s.id))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
                >
                  <PosterThumb path={s.poster_path} size="w92" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-text-primary">
                      {s.title}
                      {s.year ? ` (${s.year})` : ''}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                      <ShowTypeBadge type={s.type as ShowType} />
                      <StatusChip status={s.status as ShowStatus} />
                      {s.rating ? <StarRating value={s.rating} size={13} /> : null}
                    </span>
                    {(s.genres?.[0] || s.end_date || s.last_update_date) && (
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
                        {s.genres?.[0] && <span>{s.genres[0]}</span>}
                        {(s.end_date ?? s.last_update_date) && (
                          <span>
                            {formatDayLabel((s.end_date ?? s.last_update_date)!)}
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
