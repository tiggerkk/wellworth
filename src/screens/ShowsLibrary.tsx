import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconDeviceTv } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useSessionState } from '../hooks/useSessionState'
import { useShowsVersion, bumpShows } from '../lib/shows-refresh'
import { deleteShow, listShows } from '../data/show'
import {
  type ShowType,
  SHOW_STATUSES,
  type ShowStatus,
  SHOW_STATUS_LABELS,
} from '../constants/shows'
import { LGBTQ_REPS, LGBTQ_REP_LABELS } from '../constants/lgbtq'
import {
  applyLibraryView,
  DEFAULT_LIBRARY_CRITERIA,
  showGenres,
  type LibraryCriteria,
  type SortField,
} from '../lib/shows'
import { DYNASTIES } from '../constants/dynasty'
import { todayLocal, type IsoDate } from '../lib/date'
import { routes } from '../constants/routes'
import { SwipeRow } from '../components/SwipeRow'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SelectMenu } from '../components/SelectMenu'
import { Toggle } from '../components/Toggle'
import { Calendar } from '../components/Calendar'
import { ListSearchHeader } from '../components/ListSearchHeader'
import { FilterPanel } from '../components/FilterPanel'
import { FilterPanelFooter } from '../components/FilterPanelFooter'
import { ResultCount } from '../components/ResultCount'
import { DateRangeRow } from '../components/DateRangeRow'
import { ShowRowHeader } from '../components/ShowRowHeader'
import { PosterThumb } from '../components/PosterThumb'
import { EmptyState } from '../components/EmptyState'

type TypeFilter = 'all' | ShowType
type StatusFilter = 'all' | ShowStatus
type DateBound = 'startFrom' | 'startTo' | 'endFrom' | 'endTo'

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tv', label: 'TV' },
  { value: 'movie', label: 'Movies' },
  { value: 'documentary', label: 'Docs' },
]
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Any Status' },
  ...SHOW_STATUSES.map((s) => ({ value: s, label: SHOW_STATUS_LABELS[s] })),
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
  { value: 'title', label: 'Title' },
  { value: 'year', label: 'Year' },
  { value: 'type', label: 'Type' },
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
  const [criteria, setCriteria] = useSessionState<LibraryCriteria>(
    'wellworth:shows-library',
    DEFAULT_LIBRARY_CRITERIA,
  )
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

  // Optimistic delete: drop the row locally so it disappears instantly, instead of waiting for a
  // `bumpShows()` → full-library refetch. Override resets when a real fetch lands (adjust-state-
  // during-render, not an effect — see tech-spec F16b).
  const [override, setOverride] = useState<typeof shows>(undefined)
  const [syncedShows, setSyncedShows] = useState(shows)
  if (syncedShows !== shows) {
    setSyncedShows(shows)
    setOverride(undefined)
  }

  async function remove(id: string) {
    setOverride((prev) => (prev ?? shows ?? []).filter((s) => s.id !== id))
    try {
      await deleteShow(id)
    } catch {
      bumpShows() // resync from server on a failed delete
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
    setCriteria((c) => ({
      ...DEFAULT_LIBRARY_CRITERIA,
      //query: c.query,
      type: c.type, // Clears all filters except type (TV/Movies/Docs)
      //sortField: c.sortField,
      //sortDir: c.sortDir,
    }))
  }

  const allShows = override ?? shows ?? []
  const genreOptions = [
    { value: 'all', label: 'Any Genre' },
    ...showGenres(allShows).map((g) => ({ value: g, label: g })),
  ]
  const view = applyLibraryView(allShows, criteria)

  const boundValue: Record<DateBound, IsoDate | null> = {
    startFrom: criteria.startFrom,
    startTo: criteria.startTo,
    endFrom: criteria.endFrom,
    endTo: criteria.endTo,
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 pb-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <SegmentedTabs
          value={criteria.type}
          onChange={(t) => setCrit({ type: t })}
          options={TYPE_OPTIONS}
        />
        <ListSearchHeader
          query={criteria.query}
          onQueryChange={(q) => setCrit({ query: q })}
          placeholder="Search title, director, cast"
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((o) => !o)}
        />
        <FilterPanelFooter
          sortField={criteria.sortField}
          sortOptions={SORT_OPTIONS}
          onSortFieldChange={(f) => setCrit({ sortField: f })}
          sortDir={criteria.sortDir}
          onToggleSortDir={() =>
            setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
          }
          onClearFilters={clearFilters}
        />
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
        </FilterPanel>
      )}

      {loading && <p className="px-1 py-6 text-body text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-1 py-6 text-body text-danger">Couldn’t load your shows.</p>
      )}

      {!loading && !error && allShows.length === 0 && (
        <EmptyState
          title="No shows yet"
          actionLabel="New Show"
          to={routes.shows.entry}
          Icon={IconDeviceTv}
        />
      )}

      {!loading && !error && allShows.length > 0 && view.length > 0 && (
        <ResultCount count={view.length} />
      )}
      {!loading && !error && allShows.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          {view.length === 0 ? (
            <p className="px-4 py-6 text-center text-body text-text-tertiary">
              No matches.
            </p>
          ) : (
            view.map((s) => (
              <SwipeRow key={s.id} onDelete={() => void remove(s.id)}>
                <button
                  onClick={() => navigate(routes.shows.edit(s.id))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
                >
                  <PosterThumb path={s.poster_path} size="w92" />
                  <span className="min-w-0 flex-1">
                    <ShowRowHeader show={s} />
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
