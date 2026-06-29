import { useCallback, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { IconDeviceTv, IconHeartFilled } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useShowsVersion, bumpShows } from '../lib/shows-refresh'
import { listShows, updateShow } from '../data/show'
import {
  countWatchedThisYear,
  favoriteShows,
  isUpNext,
  lengthHint,
  markWatched,
  progressLabel,
  recentlyWatched,
  SHOW_STATUS_CHIP,
  SHOW_STATUS_LABELS,
  startWatching,
  usesEpisodes,
  type ShowRow,
  type ShowStatus,
  type ShowType,
  type ShowUpdate,
} from '../lib/shows'
import { formatMonthDay, todayLocal } from '../lib/date'
import { DYNASTY_CHIP } from '../constants/dynasty'
import { routes } from '../constants/routes'
import { SectionCard } from '../components/SectionCard'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { ShowTypeBadge } from '../components/ShowTypeBadge'
import { StatusChip } from '../components/StatusChip'
import { StarRating } from '../components/StarRating'
import { PosterThumb } from '../components/PosterThumb'
import { EmptyState } from '../components/EmptyState'

type TypeFilter = 'all' | ShowType

const WANT_SHELF_LIMIT = 6

/**
 * Shows — Dashboard. Shelves of what's in progress / to watch / recently finished, scoped by a
 * type filter, with the spec's quick actions. "Watching" de-duplicates "Up Next" (an episode-
 * tracked TV show shows under Up Next, not both); Mark Watched is also offered on Watching rows so
 * a movie in progress isn't a dead end.
 */
export function ShowsDashboard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useShowsVersion()
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fn = useCallback(() => {
    void version // refetch after a quick action / entry save (bumpShows)
    if (!userId) return Promise.resolve([])
    return listShows(userId)
  }, [userId, version])
  const { data: shows, loading, error } = useAsync(fn)

  // Optimistic override: a quick action patches the row locally so its shelf moves instantly, instead
  // of waiting for a `bumpShows()` → full-library refetch. Reset whenever a real fetch lands (the
  // adjust-state-during-render pattern, not an effect — see tech-spec F16b).
  const [override, setOverride] = useState<ShowRow[] | null>(null)
  const [syncedShows, setSyncedShows] = useState(shows)
  if (syncedShows !== shows) {
    setSyncedShows(shows)
    setOverride(null)
  }
  const all = override ?? shows ?? []
  const filtered = filter === 'all' ? all : all.filter((s) => s.type === filter)

  const favorites = favoriteShows(filtered)
  const upNext = filtered.filter(isUpNext)
  const upNextIds = new Set(upNext.map((s) => s.id))
  const watching = filtered.filter((s) => s.status === 'watching' && !upNextIds.has(s.id))
  const want = filtered.filter((s) => s.status === 'want').slice(0, WANT_SHELF_LIMIT)
  const recent = recentlyWatched(filtered, 5)
  const watchedYear = countWatchedThisYear(filtered, Number(todayLocal().slice(0, 4)))

  async function quickUpdate(id: string, patch: ShowUpdate) {
    setUpdatingId(id)
    setOverride((prev) =>
      (prev ?? shows ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
    )
    try {
      await updateShow(id, patch)
    } catch {
      bumpShows() // resync from server on a failed write
    } finally {
      setUpdatingId(null)
    }
  }

  const editShow = (id: string) => navigate(routes.shows.edit(id))

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

      {loading && <p className="px-4 py-6 text-sm text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-4 py-6 text-sm text-danger">Couldn’t load your shows.</p>
      )}

      {!loading && !error && all.length === 0 && (
        <EmptyState
          title="No shows yet"
          actionLabel="New Show"
          to={routes.shows.entry}
          Icon={IconDeviceTv}
        />
      )}

      {!loading && !error && all.length > 0 && (
        <div className="flex flex-col gap-4 px-4">
          {watchedYear > 0 && (
            <p className="px-1 text-xs text-text-secondary">
              {watchedYear} watched this year
            </p>
          )}

          {favorites.length > 0 && (
            <SectionCard title="Favourites">
              {favorites.map((s) => (
                <DashRow
                  key={s.id}
                  show={s}
                  onEdit={() => editShow(s.id)}
                  secondary={
                    <>
                      <ShowStatusChip status={s.status} />
                      {s.rating ? <StarRating value={s.rating} size={12} /> : null}
                    </>
                  }
                />
              ))}
            </SectionCard>
          )}

          {upNext.length > 0 && (
            <SectionCard title="Up Next">
              {upNext.map((s) => (
                <DashRow
                  key={s.id}
                  show={s}
                  onEdit={() => editShow(s.id)}
                  secondary={<WatchingSecondary show={s} />}
                  action={
                    <ActionButton
                      label="Mark Watched"
                      disabled={updatingId === s.id}
                      onClick={() => void quickUpdate(s.id, markWatched(s, todayLocal()))}
                    />
                  }
                />
              ))}
            </SectionCard>
          )}

          {watching.length > 0 && (
            <SectionCard title="Watching">
              {watching.map((s) => (
                <DashRow
                  key={s.id}
                  show={s}
                  onEdit={() => editShow(s.id)}
                  secondary={<WatchingSecondary show={s} />}
                  action={
                    <ActionButton
                      label="Mark Watched"
                      disabled={updatingId === s.id}
                      onClick={() => void quickUpdate(s.id, markWatched(s, todayLocal()))}
                    />
                  }
                />
              ))}
            </SectionCard>
          )}

          {want.length > 0 && (
            <SectionCard title="Want to Watch">
              {want.map((s) => (
                <DashRow
                  key={s.id}
                  show={s}
                  onEdit={() => editShow(s.id)}
                  secondary={
                    <>
                      <ShowStatusChip status={s.status} />
                      {s.genres?.[0] ? (
                        <span className="min-w-0 truncate">{s.genres[0]}</span>
                      ) : null}
                      {lengthHint(s) && <span>{lengthHint(s)}</span>}
                    </>
                  }
                  action={
                    <ActionButton
                      label="Start Watching"
                      disabled={updatingId === s.id}
                      onClick={() => void quickUpdate(s.id, startWatching(todayLocal()))}
                    />
                  }
                />
              ))}
            </SectionCard>
          )}

          {recent.length > 0 && (
            <SectionCard title="Recently Watched">
              {recent.map((s) => (
                <DashRow
                  key={s.id}
                  show={s}
                  onEdit={() => editShow(s.id)}
                  secondary={
                    <>
                      <ShowStatusChip status={s.status} />
                      {s.rating ? <StarRating value={s.rating} size={12} /> : null}
                      {s.end_date && <span>{formatMonthDay(s.end_date)}</span>}
                    </>
                  }
                />
              ))}
            </SectionCard>
          )}
        </div>
      )}
    </div>
  )
}

function DashRow({
  show,
  onEdit,
  secondary,
  action,
}: {
  show: ShowRow
  onEdit: () => void
  secondary: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
      <PosterThumb path={show.poster_path} size="w92" className="h-14 w-10" />
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5 text-[15px] text-text-primary">
          {show.is_favorite && (
            <IconHeartFilled
              size={13}
              className="shrink-0 text-favorite"
              aria-label="Favourite"
            />
          )}
          <span className="min-w-0 truncate">
            {show.title}
            {show.year ? ` (${show.year})` : ''}
          </span>
          {show.dynasty && (
            <StatusChip label={show.dynasty} className={`shrink-0 ${DYNASTY_CHIP}`} />
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-text-secondary">
          <ShowTypeBadge type={show.type as ShowType} />
          {secondary}
        </span>
      </button>
      {action}
    </div>
  )
}

/** The status pill (Want / Watching / Watched / Dropped) — shown on every dashboard row so the
 * status reads the same here as in the Library, not just implied by the shelf title. */
function ShowStatusChip({ status }: { status: string }) {
  return (
    <StatusChip
      label={SHOW_STATUS_LABELS[status as ShowStatus]}
      className={SHOW_STATUS_CHIP[status as ShowStatus]}
    />
  )
}

/** Secondary line for a watching row: the "Watching" chip + the most useful progress cue —
 * season/episode progress for an episodic title with a known total, otherwise the start date so a
 * watching movie (or a total-less title) isn't a dead end. */
function WatchingSecondary({ show }: { show: ShowRow }) {
  const hasProgress = usesEpisodes(show.type) && (show.total_episodes ?? 0) > 0
  return (
    <>
      <StatusChip
        label={SHOW_STATUS_LABELS.watching}
        className={SHOW_STATUS_CHIP.watching}
      />
      {hasProgress ? (
        <span>{progressLabel(show)}</span>
      ) : show.start_date ? (
        <span>Started {formatMonthDay(show.start_date)}</span>
      ) : null}
    </>
  )
}

function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-pill bg-input px-2.5 py-1 text-xs font-medium text-accent disabled:opacity-50"
    >
      {label}
    </button>
  )
}
