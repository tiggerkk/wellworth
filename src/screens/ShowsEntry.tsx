import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { IconQuote, IconSearch, IconX } from '@tabler/icons-react'
import { routes } from '../constants/routes'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { createShow, getShow, updateShow } from '../data/show'
import {
  isFieldVisible,
  LGBTQ_REP_LABELS,
  LGBTQ_REPS,
  posterUrl,
  SHOW_TYPE_LABELS,
  SHOW_TYPES,
  type LgbtqRep,
  type ShowRow,
  type ShowStatus,
  type ShowType,
} from '../lib/shows'
import { getTitleDetails, type TmdbSearchResult } from '../lib/tmdb-api'
import { useProfile } from '../hooks/useProfile'
import { bumpShows } from '../lib/shows-refresh'
import { formatDayLabel, todayLocal, type IsoDate } from '../lib/date'
import { Calendar } from '../components/Calendar'
import { PrimaryButton } from '../components/PrimaryButton'
import { SecondaryButton } from '../components/SecondaryButton'
import { SegmentedTabs } from '../components/SegmentedTabs'
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
  start_date: IsoDate | null
  end_date: IsoDate | null
  last_update_date: IsoDate | null
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

function blankDraft(): ShowDraft {
  const today = todayLocal()
  return {
    type: 'tv',
    title: '',
    original_title: '',
    year: '',
    status: 'want',
    rating: 0,
    lgbtq_rep: 'none',
    start_date: today,
    end_date: null,
    last_update_date: today,
    total_seasons: '',
    total_episodes: '',
    watched_seasons: '',
    watched_episodes: '',
    comments: '',
    poster_path: null,
    overview: null,
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
    start_date: row.start_date,
    end_date: row.end_date,
    last_update_date: row.last_update_date,
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

  const loadFn = useCallback(async (): Promise<ShowDraft | null> => {
    if (!id) return blankDraft()
    const row = await getShow(id)
    return row ? draftFromRow(row) : null
  }, [id])
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
  const [datePicker, setDatePicker] = useState<null | 'start' | 'end' | 'last'>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState(false)

  const update = (patch: Partial<ShowDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const isTv = draft.type === 'tv'
  const hasMeta =
    !!draft.poster_path ||
    !!draft.overview ||
    !!draft.genres?.length ||
    !!draft.director ||
    !!draft.cast?.length ||
    draft.runtime_min != null

  // Selecting a TMDB result fetches details and overwrites the metadata fields (incl. Title /
  // Original Title / Year + TV totals), keeping the user's Status / Rating / LGBT+ / dates / comments.
  async function selectTitle(r: TmdbSearchResult) {
    setSearchOpen(false)
    setMetaLoading(true)
    setMetaError(false)
    try {
      const m = await getTitleDetails(r.type, r.tmdbId)
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

  // Status convenience: entering Watched/Dropped defaults the finish date to today, and
  // marking a TV show Watched snaps the watched counts to the totals (spec).
  function changeStatus(next: ShowStatus) {
    const patch: Partial<ShowDraft> = { status: next }
    if ((next === 'watched' || next === 'dropped') && !draft.end_date) {
      patch.end_date = todayLocal()
    }
    if (next === 'watched' && draft.type === 'tv') {
      patch.watched_seasons = draft.total_seasons
      patch.watched_episodes = draft.total_episodes
    }
    update(patch)
  }

  function setDate(which: 'start' | 'end' | 'last', d: IsoDate | null) {
    if (which === 'start') update({ start_date: d })
    else if (which === 'end') update({ end_date: d })
    else update({ last_update_date: d })
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
        start_date: draft.start_date,
        end_date: draft.end_date,
        last_update_date: draft.last_update_date,
        total_seasons: isTv ? intOrNull(draft.total_seasons) : null,
        total_episodes: isTv ? intOrNull(draft.total_episodes) : null,
        watched_seasons: isTv ? intOrNull(draft.watched_seasons) : null,
        watched_episodes: isTv ? intOrNull(draft.watched_episodes) : null,
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

  const pickerDay =
    (datePicker === 'start'
      ? draft.start_date
      : datePicker === 'end'
        ? draft.end_date
        : draft.last_update_date) ?? todayLocal()

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
          {id ? 'Edit Show' : 'Add Show'}
        </h1>
        <SecondaryButton
          size="sm"
          onClick={() => setDraft(initial)}
          disabled={!dirty || saving}
        >
          RESET
        </SecondaryButton>
        <PrimaryButton
          size="sm"
          onClick={() => void save()}
          disabled={saving || !draft.title.trim() || (!!id && !dirty)}
        >
          {saving ? 'Saving…' : id ? 'SAVE' : 'CREATE'}
        </PrimaryButton>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <SegmentedTabs
          value={draft.type}
          onChange={(t) => update({ type: t })}
          options={SHOW_TYPES.map((t) => ({ value: t, label: SHOW_TYPE_LABELS[t] }))}
        />

        <div>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-input bg-input py-2 text-sm text-accent"
          >
            <IconSearch size={16} /> Search TMDB
          </button>
          {metaLoading && (
            <p className="mt-1 text-xs text-text-secondary">Fetching details…</p>
          )}
          {metaError && (
            <p className="mt-1 text-xs text-danger">Couldn’t fetch details.</p>
          )}
        </div>

        <label className="text-xs text-text-secondary">
          Title
          <input
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            className={`mt-1 ${inputClass}`}
          />
        </label>

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
                    {isTv ? 'Creator' : 'Director'}:{' '}
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

        <div>
          <p className="mb-1 text-xs text-text-secondary">Status</p>
          <SegmentedTabs
            value={draft.status}
            onChange={changeStatus}
            options={[
              { value: 'want', label: 'Want' },
              { value: 'watching', label: 'Watching' },
              { value: 'watched', label: 'Watched' },
              { value: 'dropped', label: 'Dropped' },
            ]}
          />
        </div>

        {show('rating') && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Rating</span>
            <StarRating
              value={draft.rating}
              onChange={(rating) => update({ rating })}
              size={24}
            />
          </div>
        )}

        {show('lgbtq_rep') && (
          <div>
            <p className="mb-1 text-xs text-text-secondary">LGBT+ representation</p>
            <SegmentedTabs
              value={draft.lgbtq_rep}
              onChange={(lgbtq_rep) => update({ lgbtq_rep })}
              options={LGBTQ_REPS.map((r) => ({ value: r, label: LGBTQ_REP_LABELS[r] }))}
            />
          </div>
        )}

        {show('start_date') && (
          <DateField
            label="Start Date"
            value={draft.start_date}
            onPick={() => setDatePicker('start')}
            onClear={() => setDate('start', null)}
          />
        )}
        {show('end_date') && (
          <DateField
            label="Finish / Drop Date"
            value={draft.end_date}
            onPick={() => setDatePicker('end')}
            onClear={() => setDate('end', null)}
          />
        )}
        {show('last_update_date') && (
          <DateField
            label="Last Update"
            value={draft.last_update_date}
            onPick={() => setDatePicker('last')}
            onClear={() => setDate('last', null)}
          />
        )}

        {isTv && show('episodes') && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <NumField
                label="Total Seasons"
                value={draft.total_seasons}
                onChange={(v) => update({ total_seasons: v })}
              />
              <NumField
                label="Total Episodes"
                value={draft.total_episodes}
                onChange={(v) => update({ total_episodes: v })}
              />
            </div>
            <div className="flex gap-3">
              <NumField
                label="Watched Seasons"
                value={draft.watched_seasons}
                onChange={(v) => update({ watched_seasons: v })}
              />
              <NumField
                label="Watched Episodes"
                value={draft.watched_episodes}
                onChange={(v) => update({ watched_episodes: v })}
              />
            </div>
          </div>
        )}

        {show('comments') && (
          <label className="text-xs text-text-secondary">
            Comments
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

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex-1 text-xs text-text-secondary">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 ${inputClass}`}
      />
    </label>
  )
}
