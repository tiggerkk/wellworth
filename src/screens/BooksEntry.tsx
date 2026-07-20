import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  IconArrowsDiagonal,
  IconQuote,
  IconWorldSearch,
  IconX,
} from '@tabler/icons-react'
import { routes } from '../constants/routes'
import { useAuth } from '../auth/AuthProvider'
import { useDirty } from '../hooks/useDirty'
import { useEntryDraft } from '../hooks/useEntryDraft'
import { useEntryClose } from '../hooks/useEntryClose'
import { useEntryFavorite } from '../hooks/useEntryFavorite'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { EntryLoader } from '../components/EntryLoader'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { createBook, deleteBook, getBook, updateBook } from '../data/book'
import { numStr } from '../lib/wellness-quantity'
import { FIELD_CLASS as inputClass } from '../constants/forms'
import { BOOK_STATUSES, type BookStatus, BOOK_STATUS_LABELS } from '../constants/books'
import { LGBTQ_REPS, type LgbtqRep, LGBTQ_REP_LABELS } from '../constants/lgbtq'
import { isFieldVisible, type BookRow } from '../lib/books'
import { getBookDetails, type BookSearchResult } from '../lib/books-api'
import { containsCjk } from '../lib/cjk'
import { DEFAULT_DYNASTY, DYNASTIES, type Dynasty } from '../constants/dynasty'
import { useProfile } from '../hooks/useProfile'
import { bumpBooks } from '../lib/books-refresh'
import { formatFullDate, todayLocal, type IsoDate } from '../lib/date'
import { Calendar } from '../components/Calendar'
import { BookSearchOverlay } from '../components/BookSearchOverlay'
import { CoverThumb } from '../components/CoverThumb'
import { EntryHeaderActions } from '../components/EntryHeaderActions'
import { NotesEditorOverlay } from '../components/NotesEditorOverlay'
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
 * Books — Entry / Edit (M2: manual). Outer loader + inner form keyed by id; `useEntryDraft`
 * guarantees a New-mode render never shows a previous edit's stale data (see its docstring).
 * Google Books title search + the read-only metadata block arrive in M3; the metadata columns are
 * carried through unchanged for now.
 *
 * Close/Save navigation is fixed-destination (`useEntryClose`), not a history pop: Edit Book's
 * Cancel/Save always return to the Library listing; New Book's Cancel returns to wherever it was
 * opened from, and Save moves to the new book's fixed Edit route. . `dirty` is lifted from `BookForm`
 * (via `onDirtyChange`) since the close button lives in this outer, always-mounted header.
 */
export function BooksEntry() {
  const { id } = useParams()

  const { initial, loading, error } = useEntryDraft({
    id,
    fetchRow: getBook,
    toDraft: draftFromRow,
    blank: blankDraft,
  })

  const [dirty, setDirty] = useState(false)
  const { requestClose, afterSave, confirm } = useEntryClose({
    editing: !!id,
    dirty,
    listing: routes.books.library,
    editRoute: routes.books.edit,
    dashboard: routes.books.dashboard,
  })

  useEscapeKey(requestClose)

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* 
        This outer header is always mounted! 
        It displays "Loading" gracefully with the header structure perfectly intact.
      */}
      <ScreenHeaderTitle
        title={id ? 'Edit Book' : 'New Book'}
        icon={id ? 'back' : 'close'}
        onClose={requestClose}
        actions={<div className="w-24 shrink-0" />}
      />

      <EntryLoader
        loading={loading}
        error={error}
        data={initial}
        errorText="Couldn’t load this book."
      >
        {(d) => (
          <BookForm
            key={id ?? 'new'}
            id={id}
            initial={d}
            onDirtyChange={setDirty}
            afterSave={afterSave}
          />
        )}
      </EntryLoader>

      <ConfirmDialog
        open={confirm.open}
        title="Discard changes?"
        message="You have unsaved changes to this book. Discard them?"
        onConfirm={confirm.onConfirm}
        onCancel={confirm.onCancel}
      />
    </div>
  )
}

function BookForm({
  id,
  initial: initialProp,
  onDirtyChange,
  afterSave,
}: {
  id: string | undefined
  initial: BookDraft
  onDirtyChange: (dirty: boolean) => void
  afterSave: (newId: string, toastMessage?: string) => void
}) {
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: profile } = useProfile()
  // Entry field visibility (Books Settings). Title / Status / Search are always shown.
  const show = (key: string) => isFieldVisible(profile?.book_visible_fields ?? null, key)

  // `initial` is stateful (not just the loader's prop) so an immediate favorite save (see
  // `useEntryFavorite`) can sync the dirty baseline without affecting any other in-progress edits.
  const [initial, setInitial] = useState<BookDraft>(initialProp)
  const [draft, setDraft] = useState<BookDraft>(initialProp)
  const [saving, setSaving] = useState(false)
  const [datePicker, setDatePicker] = useState<null | 'start' | 'end'>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaError, setMetaError] = useState(false)

  const update = (patch: Partial<BookDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = useDirty(draft, initial)
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
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
      const newId = id ? id : (await createBook({ ...row, user_id: userId })).id
      if (id) await updateBook(id, row)
      bumpBooks()
      afterSave(newId, id ? 'Book saved' : 'Book added')
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
      afterSave(id, 'Book deleted')
    } finally {
      setSaving(false)
    }
  }

  const toggleFavorite = useEntryFavorite({
    id,
    favorite: draft.is_favorite,
    setFavorite: (next) => update({ is_favorite: next }),
    syncInitialFavorite: (next) => setInitial((i) => ({ ...i, is_favorite: next })),
    persist: (bookId, next) => updateBook(bookId, { is_favorite: next }),
    bump: bumpBooks,
  })

  const pickerDay =
    (datePicker === 'start' ? draft.start_date : draft.end_date) ?? todayLocal()

  return (
    <>
      {/* 
        This floats actions perfectly over the empty right side of the outer mounted header.
        Because it is absolute positioned relative to the outer boundary, it stays secure on mobile viewports.
      */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-3">
        <EntryHeaderActions
          editing={!!id}
          dirty={dirty}
          saving={saving}
          canSubmit={!!draft.title.trim()}
          onReset={() => setDraft(initial)}
          onSubmit={() => void save()}
          onDelete={id ? () => void remove() : undefined}
          favorite={draft.is_favorite}
          onToggleFavorite={toggleFavorite}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-caption text-text-secondary">
              Title
              <input
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <button
              onClick={() => setSearchOpen(true)}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-input bg-input px-3 py-2 text-field text-accent"
            >
              <IconWorldSearch size={16} /> Google Books
            </button>
          </div>
          {metaLoading && (
            <p className="mt-1 text-caption text-text-secondary">Fetching details…</p>
          )}
          {metaError && (
            <p className="mt-1 text-caption text-danger">Couldn’t fetch details.</p>
          )}
        </div>

        {(show('authors') || show('year')) && (
          <div className="flex gap-3">
            {show('authors') && (
              <label className="flex-1 text-caption text-text-secondary">
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
              <label className="w-24 text-caption text-text-secondary">
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
              <div className="min-w-0 flex-1 text-caption text-text-secondary">
                {draft.genres?.length ? (
                  <p className="text-label text-text-primary">
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
              <p className="line-clamp-6 text-caption leading-relaxed text-text-secondary">
                {draft.description}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <p className="mb-1 text-caption text-text-secondary">Status</p>
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
              <p className="mb-1 text-caption text-text-secondary">Rating</p>
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
                <p className="mb-1 text-caption text-text-secondary">
                  LGBT+ Representation
                </p>
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
                <p className="mb-1 text-caption text-text-secondary">Dynasty</p>
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
          <div className="text-caption text-text-secondary">
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
            className="flex items-center justify-center gap-1.5 rounded-input bg-input py-2 text-body text-accent"
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
        <BookSearchOverlay
          initialQuery={draft.title}
          authorHint={draft.authors}
          onSelect={(r) => void selectBook(r)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {notesOpen && (
        <NotesEditorOverlay
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
      <p className="mb-1 text-caption text-text-secondary">{label}</p>
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
