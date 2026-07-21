import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { IconBook } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { fromDashboard } from '../hooks/useEntryClose'
import { useBooksVersion } from '../lib/books-refresh'
import { listBooks } from '../data/book'
import {
  countReadThisYear,
  currentlyReading,
  favoriteBooks,
  recentlyRead,
  wantToRead,
} from '../lib/books'
import { todayLocal } from '../lib/date'
import { routes } from '../constants/routes'
import { SectionCard } from '../components/SectionCard'
import { DashboardRow } from '../components/DashboardRow'
import { BookRowHeader } from '../components/BookRowHeader'
import { CoverThumb } from '../components/CoverThumb'
import { EmptyState } from '../components/EmptyState'
import { ListLoader } from '../components/ListLoader'

const WANT_SHELF_LIMIT = 6

/**
 * Books — Dashboard. Shelves of what's in progress / recently finished / to read. Simpler than the
 * Shows dashboard — books are one kind, so there's no type filter or episode/Up-Next logic.
 */
export function BooksDashboard() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useBooksVersion()

  const fn = useCallback(() => {
    void version // refetch after an entry save (bumpBooks)
    if (!userId) return Promise.resolve([])
    return listBooks(userId)
  }, [userId, version])
  const {
    data: books,
    loading,
    error,
  } = useAsync(fn, undefined, userId ? { key: `books:${userId}`, version } : undefined)

  const editBook = (id: string) => navigate(routes.books.edit(id), fromDashboard)

  return (
    <div className="flex min-h-full flex-col py-4">
      <ListLoader
        loading={loading}
        error={error}
        data={books}
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
                    <DashboardRow
                      key={b.id}
                      leading={<CoverThumb url={b.cover_url} className="h-14 w-10" />}
                      onClick={() => editBook(b.id)}
                    >
                      <BookRowHeader book={b} />
                    </DashboardRow>
                  ))}
                </SectionCard>
              )}

              {reading.length > 0 && (
                <SectionCard title="Currently Reading">
                  {reading.map((b) => (
                    <DashboardRow
                      key={b.id}
                      leading={<CoverThumb url={b.cover_url} className="h-14 w-10" />}
                      onClick={() => editBook(b.id)}
                    >
                      <BookRowHeader book={b} />
                    </DashboardRow>
                  ))}
                </SectionCard>
              )}

              {recent.length > 0 && (
                <SectionCard title="Recently Read">
                  {recent.map((b) => (
                    <DashboardRow
                      key={b.id}
                      leading={<CoverThumb url={b.cover_url} className="h-14 w-10" />}
                      onClick={() => editBook(b.id)}
                    >
                      <BookRowHeader book={b} />
                    </DashboardRow>
                  ))}
                </SectionCard>
              )}

              {want.length > 0 && (
                <SectionCard title="Want to Read">
                  {want.map((b) => (
                    <DashboardRow
                      key={b.id}
                      leading={<CoverThumb url={b.cover_url} className="h-14 w-10" />}
                      onClick={() => editBook(b.id)}
                    >
                      <BookRowHeader book={b} />
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
