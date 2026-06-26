import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  IconHeart,
  IconHeartFilled,
  IconQuote,
  IconRefresh,
  IconWorldSearch,
  IconX,
} from '@tabler/icons-react'
import { routes } from '../constants/routes'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { createShow, deleteShow, getShow, updateShow } from '../data/show'
import {
  buildRefreshPatch,
  isAbsoluteUrl,
  isFieldVisible,
  LGBTQ_REP_LABELS,
  LGBTQ_REPS,
  posterUrl,
  SHOW_TYPE_LABELS,
  SHOW_TYPES,
  usesEpisodes,
  type LgbtqRep,
  type ShowRow,
  type ShowStatus,
  type ShowType,
} from '../lib/shows'
import {
  getTitleDetails,
  refreshFromTmdb,
  tmdbLanguage,
  type TmdbSearchResult,
} from '../lib/tmdb-api'
import { containsCjk } from '../lib/cjk'
import { DEFAULT_DYNASTY, DYNASTIES, type Dynasty } from '../constants/dynasty'
import { useProfile } from '../hooks/useProfile'
import { bumpShows } from '../lib/shows-refresh'
import { formatDayLabel, todayLocal, type IsoDate } from '../lib/date'
import { Calendar } from '../components/Calendar'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SelectMenu } from '../components/SelectMenu'
import { StarRating } from '../components/StarRating'
import { TitleSearchSheet } from '../components/TitleSearchSheet'

interface ShowDraft {
  type: ShowType
  title: string
  original_title: string
  year: string
  status: ShowStatus
  rating: number
  lgbtq_rep: LgbtqRep
  dynasty: Dynasty | null
  is_favorite: boolean
  start_date: IsoDate | null
  end_date: IsoDate | null
  total_seasons: string
  total_episodes: string
  watched_seasons: string
  watched_episodes: string
  comments: string
  // TMDB-sourced metadata (read-only display; populated on select, persisted on save).
  poster_path: string | null
  overview: string | null
  genres: string[] | null
  director: string | null
  cast: string[] | null
  runtime_min: number | null
  original_language: string | null
  tmdb_id: number | null
  imdb_id: string | null
}

const numStr = (n: number | null): string => (n != null ? String(n) : '')

/** A new show, optionally prefilled from `?title=&poster=&overview=&type=`. */
interface ShowPrefill {
  title: string
  poster: string
  overview: string
  type: ShowType | null
}

function blankDraft(prefill?: ShowPrefill): ShowDraft {
  return {
    type: prefill?.type ?? 'tv',
    title: prefill?.title ?? '',
    original_title: '',
    year: '',
    status: 'want',
    rating: 0,
    lgbtq_rep: 'none',
    dynasty: null,
    is_favorite: false,
    // A new show defaults to "Want", which hasn't started — so Start Date stays blank until
    // the status moves to Watching/Watched/Dropped (see `changeStatus`).
    start_date: null,
    end_date: null,
    total_seasons: '',
    total_episodes: '',
    watched_seasons: '',
    watched_episodes: '',
    comments: '',
    poster_path: prefill?.poster || null,
    overview: prefill?.overview || null,
    genres: null,
    director: null,
    cast: null,
    runtime_min: null,
    original_language: null,
    tmdb_id: null,
    imdb_id: null,
  }
}

function draftFromRow(row: ShowRow): ShowDraft {
  return {
    type: row.type as ShowType,
    title: row.title,
    original_title: row.original_title ?? '',
    year: numStr(row.year),
    status: row.status as ShowStatus,
    rating: row.rating ?? 0,
    lgbtq_rep: (row.lgbtq_rep as LgbtqRep) ?? 'none',
    dynasty: (row.dynasty as Dynasty | null) ?? null,
    is_favorite: row.is_favorite,
    start_date: row.start_date,
    end_date: row.end_date,
    total_seasons: numStr(row.total_seasons),
    total_episodes: numStr(row.total_episodes),
    watched_seasons: numStr(row.watched_seasons),
    watched_episodes: numStr(row.watched_episodes),
    comments: row.comments ?? '',
    poster_path: row.poster_path,
    overview: row.overview,
    genres: row.genres,
    director: row.director,
    cast: row.cast,
    runtime_min: row.runtime_min,
    original_language: row.original_language,
    tmdb_id: row.tmdb_id,
    imdb_id: row.imdb_id,
  }
}

/**
 * Shows — Entry / Edit. TMDB title search populates the metadata on select (persisted only on
 * save); Title/Year stay editable so manual entry + corrections still work. Outer loader + inner
 * form keyed by id (so a stale `useAsync` result never mounts under the wrong title).
 */
export function ShowsEntry() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const title = params.get('title') ?? ''
  const poster = params.get('poster') ?? ''
  const overview = params.get('overview') ?? ''
  const typeParam = params.get('type')
  const type = (SHOW_TYPES as readonly string[]).includes(typeParam ?? '')
    ? (typeParam as ShowType)
    : null

  const loadFn = useCallback(async (): Promise<ShowDraft | null> => {
    if (!id) return blankDraft({ title, poster, overview, type })
    const row = await getShow(id)
    return row ? draftFromRow(row) : null
  }, [id, title, poster, overview, type])
  const { data: initial, loading, error } = useAsync(loadFn)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {(error || (!loading && !initial)) && (
        <p className="p-4 text-sm text-danger">Couldn’t load this show.</p>
      )}
      {!loading && initial && <ShowForm key={id ?? 'new'} id={id} initial={initial} />}
    </div>
  )
}

const inputClass =
  'w-full rounded-input bg-input px-3 py-2 text-[15px] text-text-primary focus:outline-none'

function ShowForm({ id, initial }: { id: string | undefined; initial: ShowDraft }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  // Entry field visibility (Shows Settings). Core Type/Title/Status/Search are always shown.
  const show = (key: string) => isFieldVisible(profile?.show_visible_fields ?? null, key)

  const [draft, setDraft] = useState<ShowDraft>(initial)
  const [saving, setSaving] = useState(false)
  const [datePicker, setDatePicker] = useState<null | 'start' | 'end'>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<
    null | 'updated' | 'nochange' | 'error'
  >(null)

  useEscapeKey(() => navigate(-1))

  const update = (patch: Partial<ShowDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const episodic = usesEpisodes(draft.type)
  // Dynasty is editable only for a Chinese title; the dropdown shows the default until chosen.
  const isChinese = containsCjk(draft.title)
  const hasMeta =
    !!draft.poster_path ||
    !!draft.overview ||
    !!draft.genres?.length ||
    !!draft.director ||
    !!draft.cast?.length ||
    draft.runtime_min != null
  // Poster URL field visibility: shown automatically when TMDB supplied no poster (the field is empty
  // or holds a manually pasted absolute URL), OR forced always-on via the Visible-Fields "Poster URL"
  // toggle (`profile.show_poster_url_visible`, default off — stored separately from `show_visible_fields`,
  // which is default-on, so the toggle itself can default to off).
  const posterUrlVisible =
    !!profile?.show_poster_url_visible ||
    !draft.poster_path ||
    isAbsoluteUrl(draft.poster_path)

  // Selecting a TMDB result fetches details and overwrites the metadata fields (incl. Title /
  // Original Title / Year + TV totals), keeping the user's Status / Rating / LGBT+ / dates / comments.
  async function selectTitle(r: TmdbSearchResult) {
    setSearchOpen(false)
    setMetaLoading(true)
    setMetaError(false)
    setRefreshResult(null)
    try {
      const m = await getTitleDetails(r.type, r.tmdbId, tmdbLanguage(r.title))
      setDraft((d) => ({
        ...d,
        type: r.type,
        title: m.title,
        original_title: m.original_title ?? '',
        year: m.year != null ? String(m.year) : '',
        poster_path: m.poster_path,
        overview: m.overview,
        genres: m.genres,
        director: m.director,
        cast: m.cast,
        runtime_min: m.runtime_min,
        original_language: m.original_language,
        total_seasons:
          m.total_seasons != null ? String(m.total_seasons) : d.total_seasons,
        total_episodes:
          m.total_episodes != null ? String(m.total_episodes) : d.total_episodes,
        tmdb_id: m.tmdb_id,
        imdb_id: m.imdb_id,
      }))
    } catch {
      setMetaError(true)
    } finally {
      setMetaLoading(false)
    }
  }

  // Re-pull TMDB metadata for this title (enabled once a tmdb_id exists). Updates only the
  // TMDB-sourced fields into the draft (owner fields + a manually pasted poster are preserved);
  // the owner reviews and saves. Reports "updated" / "no changes".
  async function refresh() {
    if (draft.tmdb_id == null) return
    setRefreshing(true)
    setRefreshResult(null)
    const toNum = (s: string): number | null => {
      const n = Number(s)
      return s.trim() !== '' && Number.isFinite(n) ? Math.trunc(n) : null
    }
    try {
      const meta = await refreshFromTmdb({
        type: draft.type,
        tmdb_id: draft.tmdb_id,
        title: draft.title,
        original_title: draft.original_title.trim() || null,
      })
      const { patch, changed } = buildRefreshPatch(
        {
          title: draft.title,
          original_title: draft.original_title.trim() || null,
          overview: draft.overview,
          genres: draft.genres,
          director: draft.director,
          cast: draft.cast,
          total_seasons: toNum(draft.total_seasons),
          total_episodes: toNum(draft.total_episodes),
          runtime_min: draft.runtime_min,
          original_language: draft.original_language,
          poster_path: draft.poster_path,
        },
        meta,
      )
      if (changed) {
        setDraft((d) => ({
          ...d,
          title: patch.title ?? d.title,
          original_title: patch.original_title ?? '',
          overview: patch.overview ?? null,
          genres: patch.genres ?? null,
          director: patch.director ?? null,
          cast: patch.cast ?? null,
          total_seasons:
            patch.total_seasons != null ? String(patch.total_seasons) : d.total_seasons,
          total_episodes:
            patch.total_episodes != null
              ? String(patch.total_episodes)
              : d.total_episodes,
          runtime_min: patch.runtime_min ?? null,
          original_language: patch.original_language ?? null,
          poster_path:
            patch.poster_path !== undefined ? patch.poster_path : d.poster_path,
        }))
      }
      setRefreshResult(changed ? 'updated' : 'nochange')
    } catch {
      setRefreshResult('error')
    } finally {
      setRefreshing(false)
    }
  }

  // Status convenience: entering Watching/Watched/Dropped defaults the start date to today (the
  // title has now been started); entering Watched/Dropped also defaults the finish date to today;
  // and marking an episodic title (TV / documentary) Watched snaps the watched counts to the totals.
  function changeStatus(next: ShowStatus) {
    const patch: Partial<ShowDraft> = { status: next }
    if (next !== 'want' && !draft.start_date) patch.start_date = todayLocal()
    if ((next === 'watched' || next === 'dropped') && !draft.end_date) {
      patch.end_date = todayLocal()
    }
    if (next === 'watched' && usesEpisodes(draft.type)) {
      patch.watched_seasons = draft.total_seasons
      patch.watched_episodes = draft.total_episodes
    }
    update(patch)
  }

  function setDate(which: 'start' | 'end', d: IsoDate | null) {
    if (which === 'start') update({ start_date: d })
    else update({ end_date: d })
  }

  async function save() {
    if (!userId || !draft.title.trim()) return
    setSaving(true)
    try {
      const intOrNull = (s: string): number | null => {
        const n = Number(s)
        return s.trim() !== '' && Number.isFinite(n) ? Math.trunc(n) : null
      }
      const row = {
        type: draft.type,
        title: draft.title.trim(),
        original_title: draft.original_title.trim() || null,
        year: intOrNull(draft.year),
        status: draft.status,
        rating: draft.rating || null,
        lgbtq_rep: draft.lgbtq_rep,
        // Dynasty is meaningful only for a Chinese title; clear it otherwise.
        dynasty: isChinese ? (draft.dynasty ?? DEFAULT_DYNASTY) : null,
        is_favorite: draft.is_favorite,
        start_date: draft.start_date,
        end_date: draft.end_date,
        total_seasons: episodic ? intOrNull(draft.total_seasons) : null,
        total_episodes: episodic ? intOrNull(draft.total_episodes) : null,
        watched_seasons: episodic ? intOrNull(draft.watched_seasons) : null,
        watched_episodes: episodic ? intOrNull(draft.watched_episodes) : null,
        comments: draft.comments.trim() || null,
        poster_path: draft.poster_path,
        overview: draft.overview,
        genres: draft.genres,
        director: draft.director,
        cast: draft.cast,
        runtime_min: draft.runtime_min,
        original_language: draft.original_language,
        tmdb_id: draft.tmdb_id,
        imdb_id: draft.imdb_id,
      }
      if (id) await updateShow(id, row)
      else await createShow({ ...row, user_id: userId })
      bumpShows()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!id) return
    setSaving(true)
    try {
      await deleteShow(id)
      bumpShows()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  const pickerDay =
    (datePicker === 'start' ? draft.start_date : draft.end_date) ?? todayLocal()

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Close"
          className="text-text-secondary"
        >
          <IconX size={22} />
        </button>
        <h1 className="flex-1 truncate text-[17px] font-medium text-text-primary">
          {id ? 'Edit Show' : 'New Show'}
        </h1>
        <button
          onClick={() => update({ is_favorite: !draft.is_favorite })}
          aria-label="Favourite"
        >
          {draft.is_favorite ? (
            <IconHeartFilled size={20} className="text-favorite" />
          ) : (
            <IconHeart size={20} className="text-text-tertiary" />
          )}
        </button>
        <EntryHeaderActions
          editing={!!id}
          dirty={dirty}
          saving={saving}
          canSubmit={!!draft.title.trim()}
          onReset={() => setDraft(initial)}
          onSubmit={() => void save()}
          onDelete={id ? () => void remove() : undefined}
        />
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <SegmentedTabs
          value={draft.type}
          onChange={(t) => update({ type: t })}
          options={SHOW_TYPES.map((t) => ({ value: t, label: SHOW_TYPE_LABELS[t] }))}
        />

        <div>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-text-secondary">
              Title
              <input
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-input bg-input px-3 py-2 text-sm text-accent"
            >
              <IconWorldSearch size={16} /> TMDB
            </button>
            <button
              onClick={() => void refresh()}
              disabled={draft.tmdb_id == null || refreshing}
              aria-label="Refresh from TMDB"
              title={draft.tmdb_id == null ? 'Search TMDB first' : 'Refresh from TMDB'}
              className="flex shrink-0 items-center justify-center rounded-input bg-input px-3 py-2 text-accent disabled:text-text-tertiary"
            >
              <IconRefresh size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          {metaLoading && (
            <p className="mt-1 text-xs text-text-secondary">Fetching details…</p>
          )}
          {metaError && (
            <p className="mt-1 text-xs text-danger">Couldn’t fetch details.</p>
          )}
          {refreshResult === 'updated' && (
            <p className="mt-1 text-xs text-positive">Updated from TMDB.</p>
          )}
          {refreshResult === 'nochange' && (
            <p className="mt-1 text-xs text-text-secondary">Already up to date.</p>
          )}
          {refreshResult === 'error' && (
            <p className="mt-1 text-xs text-danger">Couldn’t refresh from TMDB.</p>
          )}
        </div>

        {(show('original_title') || show('year')) && (
          <div className="flex gap-3">
            {show('original_title') && (
              <label className="flex-1 text-xs text-text-secondary">
                Original Title
                <input
                  value={draft.original_title}
                  onChange={(e) => update({ original_title: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            )}
            {show('year') && (
              <label className="w-24 text-xs text-text-secondary">
                Year
                <input
                  type="number"
                  value={draft.year}
                  onChange={(e) => update({ year: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            )}
          </div>
        )}

        {hasMeta && show('metadata') && (
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-alt p-3">
            <div className="flex gap-3">
              {draft.poster_path ? (
                <img
                  src={posterUrl(draft.poster_path, 'w185') ?? undefined}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-36 w-24 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="h-36 w-24 shrink-0 rounded bg-input" />
              )}
              <div className="min-w-0 flex-1 text-xs text-text-secondary">
                {draft.genres?.length ? (
                  <p className="text-[13px] text-text-primary">
                    {draft.genres.join(', ')}
                  </p>
                ) : null}
                {draft.director && (
                  <p className="mt-1">
                    {episodic ? 'Creator' : 'Director'}:{' '}
                    <span className="text-text-muted">{draft.director}</span>
                  </p>
                )}
                {draft.runtime_min != null && (
                  <p className="mt-1">
                    Runtime:{' '}
                    <span className="text-text-muted">{draft.runtime_min} min</span>
                  </p>
                )}
                {draft.cast?.length ? (
                  <p className="mt-1">
                    Cast: <span className="text-text-muted">{draft.cast.join(', ')}</span>
                  </p>
                ) : null}
              </div>
            </div>
            {draft.overview && (
              <p className="text-xs leading-relaxed text-text-secondary">
                {draft.overview}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <p className="mb-1 text-xs text-text-secondary">Status</p>
            <SelectMenu
              value={draft.status}
              onChange={changeStatus}
              ariaLabel="Status"
              options={[
                { value: 'want', label: 'Want' },
                { value: 'watching', label: 'Watching' },
                { value: 'watched', label: 'Watched' },
                { value: 'dropped', label: 'Dropped' },
              ]}
            />
          </div>
          {show('rating') && (
            <div>
              <p className="mb-1 text-xs text-text-secondary">Rating</p>
              <div className="flex h-8 items-center">
                <StarRating
                  value={draft.rating}
                  onChange={(rating) => update({ rating })}
                  size={24}
                />
              </div>
            </div>
          )}
        </div>

        {(show('lgbtq_rep') || show('dynasty')) && (
          <div className="grid grid-cols-2 gap-3">
            {show('lgbtq_rep') && (
              <div>
                <p className="mb-1 text-xs text-text-secondary">LGBT+ Representation</p>
                <SelectMenu
                  value={draft.lgbtq_rep}
                  onChange={(lgbtq_rep) => update({ lgbtq_rep })}
                  ariaLabel="LGBT+ representation"
                  options={LGBTQ_REPS.map((r) => ({
                    value: r,
                    label: LGBTQ_REP_LABELS[r],
                  }))}
                />
              </div>
            )}
            {show('dynasty') && (
              <div>
                <p className="mb-1 text-xs text-text-secondary">Dynasty</p>
                <SelectMenu
                  ariaLabel="Dynasty"
                  disabled={!isChinese}
                  placeholder="—"
                  value={(isChinese ? (draft.dynasty ?? DEFAULT_DYNASTY) : '') as Dynasty}
                  options={DYNASTIES.map((d) => ({ value: d, label: d }))}
                  onChange={(dynasty) => update({ dynasty })}
                />
              </div>
            )}
          </div>
        )}

        {(show('start_date') || show('end_date')) && (
          <div className="flex gap-3">
            {show('start_date') && (
              <div className="flex-1">
                <DateField
                  label="Start Date"
                  value={draft.start_date}
                  onPick={() => setDatePicker('start')}
                  onClear={() => setDate('start', null)}
                />
              </div>
            )}
            {show('end_date') && (
              <div className="flex-1">
                <DateField
                  label="Finish / Drop Date"
                  value={draft.end_date}
                  onPick={() => setDatePicker('end')}
                  onClear={() => setDate('end', null)}
                />
              </div>
            )}
          </div>
        )}

        {episodic && show('episodes') && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <p className="text-xs text-text-secondary">Total Seasons / Episodes</p>
              <p className="text-xs text-text-secondary">Watched Seasons / Episodes</p>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={draft.total_seasons}
                  onChange={(e) => update({ total_seasons: e.target.value })}
                  placeholder="Seasons"
                  className={`${inputClass} min-w-0 flex-1 placeholder:text-text-tertiary`}
                />
                <input
                  type="number"
                  min={0}
                  value={draft.total_episodes}
                  onChange={(e) => update({ total_episodes: e.target.value })}
                  placeholder="Episodes"
                  className={`${inputClass} min-w-0 flex-1 placeholder:text-text-tertiary`}
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={draft.watched_seasons}
                  onChange={(e) => update({ watched_seasons: e.target.value })}
                  placeholder="Seasons"
                  className={`${inputClass} min-w-0 flex-1 placeholder:text-text-tertiary`}
                />
                <input
                  type="number"
                  min={0}
                  value={draft.watched_episodes}
                  onChange={(e) => update({ watched_episodes: e.target.value })}
                  placeholder="Episodes"
                  className={`${inputClass} min-w-0 flex-1 placeholder:text-text-tertiary`}
                />
              </div>
            </div>
          </div>
        )}

        {posterUrlVisible && (
          <label className="text-xs text-text-secondary">
            Poster URL
            <input
              value={draft.poster_path ?? ''}
              onChange={(e) => update({ poster_path: e.target.value.trim() || null })}
              placeholder="Paste a direct image URL (optional)"
              className={`mt-1 ${inputClass}`}
            />
          </label>
        )}

        {show('comments') && (
          <label className="text-xs text-text-secondary">
            Notes
            <textarea
              value={draft.comments}
              onChange={(e) => update({ comments: e.target.value })}
              rows={3}
              className={`mt-1 ${inputClass} resize-none`}
            />
          </label>
        )}

        {id && (
          <Link
            to={`${routes.quotes.library}?show=${id}`}
            className="flex items-center justify-center gap-1.5 rounded-input bg-input py-2 text-sm text-accent"
          >
            <IconQuote size={16} /> Quotes from this title
          </Link>
        )}
      </div>

      {datePicker && (
        <Calendar
          day={pickerDay}
          onSelect={(d) => {
            setDate(datePicker, d)
            setDatePicker(null)
          }}
          onClose={() => setDatePicker(null)}
        />
      )}

      {searchOpen && (
        <TitleSearchSheet
          type={draft.type}
          initialQuery={draft.title}
          onSelect={(r) => void selectTitle(r)}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </>
  )
}

function DateField({
  label,
  value,
  onPick,
  onClear,
}: {
  label: string
  value: IsoDate | null
  onPick: () => void
  onClear: () => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-text-secondary">{label}</p>
      <div className="flex items-center gap-2">
        <button onClick={onPick} className={`flex-1 text-left ${inputClass}`}>
          {value ? (
            formatDayLabel(value)
          ) : (
            <span className="text-text-tertiary">Set date</span>
          )}
        </button>
        {value && (
          <button
            onClick={onClear}
            aria-label={`Clear ${label}`}
            className="p-1 text-text-tertiary"
          >
            <IconX size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
