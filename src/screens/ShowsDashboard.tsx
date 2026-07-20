import { useCallback, useState } from 'react'
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
  favoriteShows,
  isUpNext,
  recentlyWatched,
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

type TypeFilter = 'all' | ShowType

const WANT_SHELF_LIMIT = 6

/**
 * Shows — Dashboard. Shelves of what's in progress / to watch / recently finished, scoped by a
 * type filter. "Watching" de-duplicates "Up Next" (an episode-tracked TV show shows under Up Next,
 * not both).
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
  const { data: shows, loading, error } = useAsync(fn)

  const editShow = (id: string) => navigate(routes.shows.edit(id), fromDashboard)

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
        {(all) => {
          const filtered = filter === 'all' ? all : all.filter((s) => s.type === filter)
          const favorites = favoriteShows(filtered)
          const upNext = filtered.filter(isUpNext)
          const upNextIds = new Set(upNext.map((s) => s.id))
          const watching = filtered.filter(
            (s) => s.status === 'watching' && !upNextIds.has(s.id),
          )
          const want = filtered
            .filter((s) => s.status === 'want')
            .slice(0, WANT_SHELF_LIMIT)
          const recent = recentlyWatched(filtered, 5)
          const watchedYear = countWatchedThisYear(
            filtered,
            Number(todayLocal().slice(0, 4)),
          )

          return (
            <div className="flex flex-col gap-4 px-4">
              {watchedYear > 0 && (
                <p className="px-1 text-caption text-text-secondary">
                  {watchedYear} watched this year
                </p>
              )}

              {favorites.length > 0 && (
                <SectionCard title="Favourites">
                  {favorites.map((s) => (
                    <DashboardRow
                      key={s.id}
                      leading={
                        <PosterThumb
                          path={s.poster_path}
                          size="w92"
                          className="h-14 w-10"
                        />
                      }
                      onClick={() => editShow(s.id)}
                    >
                      <ShowRowHeader show={s} />
                    </DashboardRow>
                  ))}
                </SectionCard>
              )}

              {upNext.length > 0 && (
                <SectionCard title="Up Next">
                  {upNext.map((s) => (
                    <DashboardRow
                      key={s.id}
                      leading={
                        <PosterThumb
                          path={s.poster_path}
                          size="w92"
                          className="h-14 w-10"
                        />
                      }
                      onClick={() => editShow(s.id)}
                    >
                      <ShowRowHeader show={s} />
                    </DashboardRow>
                  ))}
                </SectionCard>
              )}

              {watching.length > 0 && (
                <SectionCard title="Currently Watching">
                  {watching.map((s) => (
                    <DashboardRow
                      key={s.id}
                      leading={
                        <PosterThumb
                          path={s.poster_path}
                          size="w92"
                          className="h-14 w-10"
                        />
                      }
                      onClick={() => editShow(s.id)}
                    >
                      <ShowRowHeader show={s} />
                    </DashboardRow>
                  ))}
                </SectionCard>
              )}

              {want.length > 0 && (
                <SectionCard title="Want to Watch">
                  {want.map((s) => (
                    <DashboardRow
                      key={s.id}
                      leading={
                        <PosterThumb
                          path={s.poster_path}
                          size="w92"
                          className="h-14 w-10"
                        />
                      }
                      onClick={() => editShow(s.id)}
                    >
                      <ShowRowHeader show={s} />
                    </DashboardRow>
                  ))}
                </SectionCard>
              )}

              {recent.length > 0 && (
                <SectionCard title="Recently Watched">
                  {recent.map((s) => (
                    <DashboardRow
                      key={s.id}
                      leading={
                        <PosterThumb
                          path={s.poster_path}
                          size="w92"
                          className="h-14 w-10"
                        />
                      }
                      onClick={() => editShow(s.id)}
                    >
                      <ShowRowHeader show={s} />
                    </DashboardRow>
                  ))}
                </SectionCard>
              )}
            </div>
          )
        }}
      </ListLoader>
    </div>
  )
}
