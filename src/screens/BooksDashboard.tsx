import { useCallback, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { IconBook, IconHeartFilled } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useBooksVersion, bumpBooks } from '../lib/books-refresh'
import { listBooks, updateBook } from '../data/book'
import {
  BOOK_STATUS_CHIP,
  BOOK_STATUS_LABELS,
  countReadThisYear,
  currentlyReading,
  favoriteBooks,
  markRead,
  recentlyRead,
  startReading,
  wantToRead,
  type BookRow,
  type BookStatus,
  type BookUpdate,
} from '../lib/books'
import { formatMonthDay, todayLocal } from '../lib/date'
import { DYNASTY_CHIP } from '../constants/dynasty'
import { routes } from '../constants/routes'
import { SectionCard } from '../components/SectionCard'
import { StarRating } from '../components/StarRating'
import { StatusChip } from '../components/StatusChip'
import { CoverThumb } from '../components/CoverThumb'
import { EmptyState } from '../components/EmptyState'

const WANT_SHELF_LIMIT = 6

/**
 * Books — Dashboard. Shelves of what's in progress / recently finished / to read, with the spec's
 * quick actions (Mark Read, Start Reading). Simpler than the Shows dashboard — books are one kind,
 * so there's no type filter or episode/Up-Next logic.
 */
export function BooksDashboard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useBooksVersion()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fn = useCallback(() => {
    void version // refetch after a quick action / entry save (bumpBooks)
    if (!userId) return Promise.resolve([])
    return listBooks(userId)
  }, [userId, version])
  const { data: books, loading, error } = useAsync(fn)

  // Optimistic override: a quick action patches the row locally so its shelf moves instantly, instead
  // of waiting for a `bumpBooks()` → full-library refetch. Reset whenever a real fetch lands (the
  // adjust-state-during-render pattern, not an effect — see tech-spec F16b).
  const [override, setOverride] = useState<BookRow[] | null>(null)
  const [syncedBooks, setSyncedBooks] = useState(books)
  if (syncedBooks !== books) {
    setSyncedBooks(books)
    setOverride(null)
  }
  const all = override ?? books ?? []
  const favorites = favoriteBooks(all)
  const reading = currentlyReading(all)
  const recent = recentlyRead(all, 5)
  const want = wantToRead(all, WANT_SHELF_LIMIT)
  const readYear = countReadThisYear(all, Number(todayLocal().slice(0, 4)))

  async function quickUpdate(id: string, patch: BookUpdate) {
    setUpdatingId(id)
    setOverride((prev) =>
      (prev ?? books ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
    )
    try {
      await updateBook(id, patch)
    } catch {
      bumpBooks() // resync from server on a failed write
    } finally {
      setUpdatingId(null)
    }
  }

  const editBook = (id: string) => navigate(routes.books.edit(id))

  return (
    <div className="flex min-h-full flex-col pb-4">
      {loading && <p className="px-4 py-6 text-body text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-4 py-6 text-body text-danger">Couldn’t load your books.</p>
      )}

      {!loading && !error && all.length === 0 && (
        <EmptyState
          title="No books yet"
          actionLabel="New Book"
          to={routes.books.entry}
          Icon={IconBook}
        />
      )}

      {!loading && !error && all.length > 0 && (
        <div className="flex flex-col gap-4 px-4">
          {readYear > 0 && (
            <p className="px-1 text-caption text-text-secondary">
              {readYear} read this year
            </p>
          )}

          {favorites.length > 0 && (
            <SectionCard title="Favourites">
              {favorites.map((b) => (
                <DashRow
                  key={b.id}
                  book={b}
                  onEdit={() => editBook(b.id)}
                  secondary={<BookStatusChip status={b.status} />}
                />
              ))}
            </SectionCard>
          )}

          {reading.length > 0 && (
            <SectionCard title="Currently Reading">
              {reading.map((b) => (
                <DashRow
                  key={b.id}
                  book={b}
                  onEdit={() => editBook(b.id)}
                  secondary={
                    <>
                      <BookStatusChip status={b.status} />
                      {b.authors?.length ? (
                        <span className="min-w-0 truncate">{b.authors.join(', ')}</span>
                      ) : null}
                    </>
                  }
                  action={
                    <ActionButton
                      label="Mark Read"
                      disabled={updatingId === b.id}
                      onClick={() => void quickUpdate(b.id, markRead(todayLocal()))}
                    />
                  }
                />
              ))}
            </SectionCard>
          )}

          {recent.length > 0 && (
            <SectionCard title="Recently Read">
              {recent.map((b) => (
                <DashRow
                  key={b.id}
                  book={b}
                  onEdit={() => editBook(b.id)}
                  secondary={
                    <>
                      <BookStatusChip status={b.status} />
                      {b.rating ? <StarRating value={b.rating} size={12} /> : null}
                      {b.end_date && <span>{formatMonthDay(b.end_date)}</span>}
                    </>
                  }
                />
              ))}
            </SectionCard>
          )}

          {want.length > 0 && (
            <SectionCard title="Want to Read">
              {want.map((b) => (
                <DashRow
                  key={b.id}
                  book={b}
                  onEdit={() => editBook(b.id)}
                  secondary={
                    <>
                      <BookStatusChip status={b.status} />
                      {b.authors?.length ? (
                        <span className="min-w-0 truncate">{b.authors.join(', ')}</span>
                      ) : null}
                    </>
                  }
                  action={
                    <ActionButton
                      label="Start Reading"
                      disabled={updatingId === b.id}
                      onClick={() => void quickUpdate(b.id, startReading(todayLocal()))}
                    />
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
  book,
  onEdit,
  secondary,
  action,
}: {
  book: BookRow
  onEdit: () => void
  secondary: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
      <CoverThumb url={book.cover_url} className="h-14 w-10" />
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5 text-body text-text-primary">
          {book.is_favorite && (
            <IconHeartFilled
              size={13}
              className="shrink-0 text-favorite"
              aria-label="Favourite"
            />
          )}
          <span className="min-w-0 truncate">
            {book.title}
            {book.year ? ` (${book.year})` : ''}
          </span>
          {book.dynasty && (
            <StatusChip label={book.dynasty} className={`shrink-0 ${DYNASTY_CHIP}`} />
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-caption text-text-secondary">
          {secondary}
        </span>
      </button>
      {action}
    </div>
  )
}

/** The status pill (Want to Read / Reading / Read / Dropped) — shown on every dashboard row so the
 * status reads the same here as in the Library, not just implied by the shelf title. */
function BookStatusChip({ status }: { status: string }) {
  return (
    <StatusChip
      label={BOOK_STATUS_LABELS[status as BookStatus]}
      className={BOOK_STATUS_CHIP[status as BookStatus]}
    />
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
      className="shrink-0 rounded-pill bg-input px-2.5 py-1 text-caption font-medium text-accent disabled:opacity-50"
    >
      {label}
    </button>
  )
}
