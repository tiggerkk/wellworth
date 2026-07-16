import { useCallback, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { IconBook } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useBooksVersion, bumpBooks } from '../lib/books-refresh'
import { listBooks, updateBook } from '../data/book'
import {
  countReadThisYear,
  currentlyReading,
  favoriteBooks,
  markRead,
  recentlyRead,
  startReading,
  wantToRead,
  type BookRow,
  type BookUpdate,
} from '../lib/books'
import { todayLocal } from '../lib/date'
import { routes } from '../constants/routes'
import { SectionCard } from '../components/SectionCard'
import { BookRowHeader } from '../components/BookRowHeader'
import { CoverThumb } from '../components/CoverThumb'
import { EmptyState } from '../components/EmptyState'
import { ListLoader } from '../components/ListLoader'

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
    <div className="flex min-h-full flex-col py-4">
      <ListLoader
        loading={loading}
        error={error}
        data={override ?? books}
        errorText="Couldn’t load your books."
        emptyState={
          <EmptyState
            title="No books yet"
            actionLabel="New Book"
            to={routes.books.entry}
            Icon={IconBook}
          />
        }
      >
        {(all) => {
          const favorites = favoriteBooks(all)
          const reading = currentlyReading(all)
          const recent = recentlyRead(all, 5)
          const want = wantToRead(all, WANT_SHELF_LIMIT)
          const readYear = countReadThisYear(all, Number(todayLocal().slice(0, 4)))

          return (
            <div className="flex flex-col gap-4 px-4">
              {readYear > 0 && (
                <p className="px-1 text-caption text-text-secondary">
                  {readYear} read this year
                </p>
              )}

              {favorites.length > 0 && (
                <SectionCard title="Favourites">
                  {favorites.map((b) => (
                    <DashRow key={b.id} book={b} onEdit={() => editBook(b.id)} />
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
                    <DashRow key={b.id} book={b} onEdit={() => editBook(b.id)} />
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
                      action={
                        <ActionButton
                          label="Start Reading"
                          disabled={updatingId === b.id}
                          onClick={() =>
                            void quickUpdate(b.id, startReading(todayLocal()))
                          }
                        />
                      }
                    />
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

function DashRow({
  book,
  onEdit,
  action,
}: {
  book: BookRow
  onEdit: () => void
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
      <CoverThumb url={book.cover_url} className="h-14 w-10" />
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <BookRowHeader book={book} />
      </button>
      {action}
    </div>
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
