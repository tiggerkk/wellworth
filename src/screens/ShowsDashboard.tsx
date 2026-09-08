import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconDeviceTv } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { fromDashboard } from '../hooks/useEntryClose'
import { useShowsVersion } from '../lib/shows-refresh'
import { listShows } from '../data/show'
import { type ShowType } from '../constants/shows'
import {
  countWatchedThisYear,
  isCaughtUp,
  recentlyWatched,
  sortByRecency,
} from '../lib/shows'
import { todayLocal } from '../lib/date'
import { routes } from '../constants/routes'
import { SectionCard } from '../components/SectionCard'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { DashboardRow } from '../components/DashboardRow'
import { ShowRowHeader } from '../components/ShowRowHeader'
import { PosterThumb } from '../components/PosterThumb'
import { EmptyState } from '../components/EmptyState'
import { ListLoader } from '../components/ListLoader'
import type { ShowRow } from '../lib/shows'

type TypeFilter = 'all' | ShowType

const WANT_SHELF_LIMIT = 6

/**
 * Shows — Dashboard. Shelves of what's in progress / to watch / recently finished, scoped by a
 * type filter. "Currently Watching" excludes titles that are fully caught up on known episodes —
 * those move to the "Caught Up" shelf instead (still status "Watching", just waiting on more).
 */
export function ShowsDashboard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useShowsVersion()
  const [filter, setFilter] = useState<TypeFilter>('all')

  const fn = useCallback(() => {
    void version // refetch after an entry save (bumpShows)
    if (!userId) return Promise.resolve([])
    return listShows(userId)
  }, [userId, version])
  const {
    data: shows,
    loading,
    error,
  } = useAsync(fn, undefined, userId ? { key: `shows:${userId}`, version } : undefined)

  const editShow = (id: string) => navigate(routes.shows.edit(id), fromDashboard)

  const shelves = useMemo(() => {
    const all = shows ?? []
    const filtered = filter === 'all' ? all : all.filter((s) => s.type === filter)
    const caughtUp = sortByRecency(filtered.filter(isCaughtUp))
    const caughtUpIds = new Set(caughtUp.map((s) => s.id))
    const watching = sortByRecency(
      filtered.filter((s) => s.status === 'watching' && !caughtUpIds.has(s.id)),
    )
    const want = sortByRecency(filtered.filter((s) => s.status === 'want')).slice(
      0,
      WANT_SHELF_LIMIT,
    )
    const recent = recentlyWatched(filtered, 5)
    const watchedYear = countWatchedThisYear(filtered, Number(todayLocal().slice(0, 4)))
    return { watching, caughtUp, want, recent, watchedYear }
  }, [shows, filter])

  return (
    <div className="flex min-h-full flex-col pb-4">
      <header className="sticky top-0 z-10 flex flex-col gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <SegmentedTabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'tv', label: 'TV' },
            { value: 'movie', label: 'Movies' },
            { value: 'documentary', label: 'Docs' },
          ]}
        />
      </header>

      <ListLoader
        loading={loading}
        error={error}
        data={shows}
        errorText="Couldn’t load your shows."
        emptyState={
          <EmptyState
            title="No shows yet"
            actionLabel="New Show"
            to={routes.shows.entry}
            Icon={IconDeviceTv}
          />
        }
      >
        {() => {
          const { watching, caughtUp, want, recent, watchedYear } = shelves

          return (
            <div className="flex flex-col gap-4 px-4">
              {watchedYear > 0 && (
                <p className="px-1 text-caption text-text-secondary">
                  {watchedYear} watched this year
                </p>
              )}

              {watching.length > 0 && (
                <ShowShelf
                  title="Currently Watching"
                  shows={watching}
                  onSelect={editShow}
                />
              )}

              {caughtUp.length > 0 && (
                <ShowShelf title="Caught Up" shows={caughtUp} onSelect={editShow} />
              )}

              {want.length > 0 && (
                <ShowShelf title="Want to Watch" shows={want} onSelect={editShow} />
              )}

              {recent.length > 0 && (
                <ShowShelf title="Recently Watched" shows={recent} onSelect={editShow} />
              )}
            </div>
          )
        }}
      </ListLoader>
    </div>
  )
}

/** One dashboard shelf: a `SectionCard` of `DashboardRow`s sharing the same poster-thumb + row
 * layout — every shelf (Currently Watching, Caught Up, Want to Watch, Recently Watched) renders
 * identically, so this is the single place that layout is defined. */
function ShowShelf({
  title,
  shows,
  onSelect,
}: {
  title: string
  shows: ShowRow[]
  onSelect: (id: string) => void
}) {
  return (
    <SectionCard title={title}>
      {shows.map((s) => (
        <DashboardRow
          key={s.id}
          leading={<PosterThumb path={s.poster_path} size="w92" className="h-14 w-10" />}
          onClick={() => onSelect(s.id)}
        >
          <ShowRowHeader show={s} />
        </DashboardRow>
      ))}
    </SectionCard>
  )
}
