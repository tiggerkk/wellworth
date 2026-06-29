import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  IconArrowsDiagonal,
  IconHeart,
  IconHeartFilled,
  IconQuote,
  IconWorldSearch,
  IconX,
} from '@tabler/icons-react'
import { routes } from '../constants/routes'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { createBook, deleteBook, getBook, updateBook } from '../data/book'
import {
  BOOK_STATUS_LABELS,
  BOOK_STATUSES,
  isFieldVisible,
  LGBTQ_REP_LABELS,
  LGBTQ_REPS,
  type BookRow,
  type BookStatus,
  type LgbtqRep,
} from '../lib/books'
import { getBookDetails, type BookSearchResult } from '../lib/books-api'
import { containsCjk } from '../lib/cjk'
import { DEFAULT_DYNASTY, DYNASTIES, type Dynasty } from '../constants/dynasty'
import { useProfile } from '../hooks/useProfile'
import { bumpBooks } from '../lib/books-refresh'
import { formatFullDate, todayLocal, type IsoDate } from '../lib/date'
import { Calendar } from '../components/Calendar'
import { BookSearchSheet } from '../components/BookSearchSheet'
import { CoverThumb } from '../components/CoverThumb'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { NotesEditorModal } from '../components/NotesEditorModal'
import { SelectMenu } from '../components/SelectMenu'
import { StarRating } from '../components/StarRating'

interface BookDraft {
  title: string
  authors: string // comma-separated in the form; split to text[] on save
  year: string
  status: BookStatus
  rating: number
  lgbtq_rep: LgbtqRep
  dynasty: Dynasty | null
  is_favorite: boolean
  start_date: IsoDate | null
  end_date: IsoDate | null
  notes: string
  // Carry-through metadata (Google Books / Open Library populate these in M3; persisted as-is).
  cover_url: string | null
  description: string | null
  genres: string[] | null
  page_count: number | null
  language: string | null
  google_books_id: string | null
  open_library_id: string | null
  isbn: string | null
}

const numStr = (n: number | null): string => (n != null ? String(n) : '')

function blankDraft(): BookDraft {
  const today = todayLocal()
  return {
    title: '',
    authors: '',
    year: '',
    status: 'want',
    rating: 0,
    lgbtq_rep: 'none',
    dynasty: null,
    is_favorite: false,
    start_date: today,
    end_date: null,
    notes: '',
    cover_url: null,
    description: null,
    genres: null,
    page_count: null,
    language: null,
    google_books_id: null,
    open_library_id: null,
    isbn: null,
  }
}

function draftFromRow(row: BookRow): BookDraft {
  return {
    title: row.title,
    authors: (row.authors ?? []).join(', '),
    year: numStr(row.year),
    status: row.status as BookStatus,
    rating: row.rating ?? 0,
    lgbtq_rep: (row.lgbtq_rep as LgbtqRep) ?? 'none',
    dynasty: (row.dynasty as Dynasty | null) ?? null,
    is_favorite: row.is_favorite,
    start_date: row.start_date,
    end_date: row.end_date,
    notes: row.notes ?? '',
    cover_url: row.cover_url,
    description: row.description,
    genres: row.genres,
    page_count: row.page_count,
    language: row.language,
    google_books_id: row.google_books_id,
    open_library_id: row.open_library_id,
    isbn: row.isbn,
  }
}

/**
 * Books — Entry / Edit (M2: manual). Outer loader + inner form keyed by id (so a stale `useAsync`
 * result never mounts under the wrong title). Google Books title search + the read-only metadata
 * block arrive in M3; the metadata columns are carried through unchanged for now.
 */
export function BooksEntry() {
  const { id } = useParams()

  const loadFn = useCallback(async (): Promise<BookDraft | null> => {
    if (!id) return blankDraft()
    const row = await getBook(id)
    return row ? draftFromRow(row) : null
  }, [id])
  const { data: initial, loading, error } = useAsync(loadFn)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {loading && <p className="p-4 text-sm text-text-secondary">Loading…</p>}
      {(error || (!loading && !initial)) && (
        <p className="p-4 text-sm text-danger">Couldn’t load this book.</p>
      )}
      {!loading && initial && <BookForm key={id ?? 'new'} id={id} initial={initial} />}
    </div>
  )
}

// Shared single-line field standard — see `.field-control` in index.css.
const inputClass = 'field-control w-full'

function BookForm({ id, initial }: { id: string | undefined; initial: BookDraft }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  // Entry field visibility (Books Settings). Title / Status / Search are always shown.
  const show = (key: string) => isFieldVisible(profile?.book_visible_fields ?? null, key)

  const [draft, setDraft] = useState<BookDraft>(initial)
  const [saving, setSaving] = useState(false)
  const [datePicker, setDatePicker] = useState<null | 'start' | 'end'>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState(false)
  useEscapeKey(() => navigate(-1))

  const update = (patch: Partial<BookDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  // Dynasty is editable only for a Chinese title; the dropdown shows the default until chosen.
  const isChinese = containsCjk(draft.title)
  const hasMeta =
    !!draft.cover_url ||
    !!draft.description ||
    !!draft.genres?.length ||
    draft.page_count != null ||
    !!draft.language

  // Selecting a search result fetches details and overwrites the metadata fields (incl. Title /
  // Author(s) / Year), keeping the user's Status / Rating / LGBT+ / dates / notes.
  async function selectBook(r: BookSearchResult) {
    setSearchOpen(false)
    setMetaLoading(true)
    setMetaError(false)
    try {
      const m = await getBookDetails(r)
      setDraft((d) => ({
        ...d,
        title: m.title || d.title,
        authors: m.authors?.length ? m.authors.join(', ') : d.authors,
        year: m.year != null ? String(m.year) : d.year,
        cover_url: m.cover_url,
        description: m.description,
        genres: m.genres,
        page_count: m.page_count,
        language: m.language,
        isbn: m.isbn,
        google_books_id: m.google_books_id,
        open_library_id: m.open_library_id,
      }))
    } catch {
      setMetaError(true)
    } finally {
      setMetaLoading(false)
    }
  }

  // Status convenience: entering Reading defaults the start date to today; entering Read/Dropped
  // defaults the finish date to today (both editable, only when not already set).
  function changeStatus(next: BookStatus) {
    const patch: Partial<BookDraft> = { status: next }
    if (next === 'reading' && !draft.start_date) patch.start_date = todayLocal()
    if ((next === 'read' || next === 'dropped') && !draft.end_date) {
      patch.end_date = todayLocal()
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
      const authors = draft.authors
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
      const row = {
        title: draft.title.trim(),
        authors: authors.length ? authors : null,
        year: intOrNull(draft.year),
        status: draft.status,
        rating: draft.rating || null,
        lgbtq_rep: draft.lgbtq_rep,
        // Dynasty is meaningful only for a Chinese title; clear it otherwise.
        dynasty: isChinese ? (draft.dynasty ?? DEFAULT_DYNASTY) : null,
        is_favorite: draft.is_favorite,
        start_date: draft.start_date,
        end_date: draft.end_date,
        notes: draft.notes.trim() || null,
        cover_url: draft.cover_url,
        description: draft.description,
        genres: draft.genres,
        page_count: draft.page_count,
        language: draft.language,
        google_books_id: draft.google_books_id,
        open_library_id: draft.open_library_id,
        isbn: draft.isbn,
      }
      if (id) await updateBook(id, row)
      else await createBook({ ...row, user_id: userId })
      bumpBooks()
      navigate(-1)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!id) return
    setSaving(true)
    try {
      await deleteBook(id)
      bumpBooks()
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
          {id ? 'Edit Book' : 'New Book'}
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
              <IconWorldSearch size={16} /> Google Books
            </button>
          </div>
          {metaLoading && (
            <p className="mt-1 text-xs text-text-secondary">Fetching details…</p>
          )}
          {metaError && (
            <p className="mt-1 text-xs text-danger">Couldn’t fetch details.</p>
          )}
        </div>

        {(show('authors') || show('year')) && (
          <div className="flex gap-3">
            {show('authors') && (
              <label className="flex-1 text-xs text-text-secondary">
                Author(s)
                <input
                  value={draft.authors}
                  onChange={(e) => update({ authors: e.target.value })}
                  placeholder="Comma-separated"
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
              <CoverThumb url={draft.cover_url} className="h-36 w-24" />
              <div className="min-w-0 flex-1 text-xs text-text-secondary">
                {draft.genres?.length ? (
                  <p className="text-[13px] text-text-primary">
                    {draft.genres.join(', ')}
                  </p>
                ) : null}
                {draft.page_count != null && (
                  <p className="mt-1">
                    Pages: <span className="text-text-muted">{draft.page_count}</span>
                  </p>
                )}
                {draft.language && (
                  <p className="mt-1">
                    Language: <span className="text-text-muted">{draft.language}</span>
                  </p>
                )}
              </div>
            </div>
            {draft.description && (
              <p className="line-clamp-6 text-xs leading-relaxed text-text-secondary">
                {draft.description}
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
              options={BOOK_STATUSES.map((s) => ({
                value: s,
                label: BOOK_STATUS_LABELS[s],
              }))}
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

        {show('notes') && (
          <div className="text-xs text-text-secondary">
            <div className="flex items-center justify-between">
              <span>Notes</span>
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                aria-label="Expand notes"
                className="text-accent"
              >
                <IconArrowsDiagonal size={16} />
              </button>
            </div>
            <textarea
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
              rows={4}
              className={`mt-1 ${inputClass} resize-none`}
            />
          </div>
        )}

        {id && (
          <Link
            to={`${routes.quotes.library}?book=${id}`}
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
        <BookSearchSheet
          initialQuery={draft.title}
          authorHint={draft.authors}
          onSelect={(r) => void selectBook(r)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {notesOpen && (
        <NotesEditorModal
          title={draft.title}
          year={Number.parseInt(draft.year, 10) || null}
          value={draft.notes}
          onSave={(next) => update({ notes: next })}
          onClose={() => setNotesOpen(false)}
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
            formatFullDate(value)
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
