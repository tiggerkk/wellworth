import { useCallback, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { listShows } from '../data/show'
import { listBooks } from '../data/book'
import { posterUrl } from '../lib/shows'
import { filterLinkCandidates, type LinkCandidate } from '../lib/quotes'
import type { QuoteSourceType } from '../constants/quotes'
import { OverlayTop } from './OverlayTop'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { SearchBar } from './SearchBar'
import { Thumb } from './Thumb'
import { StatusChip } from './StatusChip'

// Link candidates only ever carry a linking source type (tv/movie for shows, book for books); these
// are the protected keys, so a short fixed label is enough (fallback to the raw value for safety).
const KIND_LABEL: Partial<Record<QuoteSourceType, string>> = {
  tv: 'TV',
  movie: 'Movie',
  book: 'Book',
}

interface QuoteSourceLinkOverlayProps {
  onSelect: (candidate: LinkCandidate) => void
  onClose: () => void
  /** Seed the search box (e.g. the Entry form's current Title) so results filter on open. */
  initialQuery?: string
}

/**
 * Cross-module source linker — a **local** fixed overlay (not the routing `Sheet`, which would put
 * the Entry form behind a background-location and remount it, losing the in-progress draft; same
 * lesson as Shows `TitleSearchOverlay` / Books `BookSearchOverlay`). Searches the user's own `show` +
 * `book` rows (no external API); selecting one hands a `LinkCandidate` back via `onSelect`.
 */
export function QuoteSourceLinkOverlay({
  onSelect,
  onClose,
  initialQuery = '',
}: QuoteSourceLinkOverlayProps) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [query, setQuery] = useState(initialQuery)

  const loadFn = useCallback(async (): Promise<LinkCandidate[]> => {
    if (!userId) return []
    const [shows, books] = await Promise.all([listShows(userId), listBooks(userId)])
    const showCands: LinkCandidate[] = shows.map((s) => ({
      kind: 'show',
      id: s.id,
      title: s.title,
      year: s.year,
      thumbUrl: posterUrl(s.poster_path, 'w92'),
      sourceType: s.type as QuoteSourceType,
      authors: [],
    }))
    const bookCands: LinkCandidate[] = books.map((b) => ({
      kind: 'book',
      id: b.id,
      title: b.title,
      year: b.year,
      thumbUrl: b.cover_url,
      sourceType: 'book',
      authors: b.authors ?? [],
    }))
    return [...showCands, ...bookCands]
  }, [userId])
  const { data: candidates, loading, error } = useAsync(loadFn)

  const all = candidates ?? []
  const results = filterLinkCandidates(all, query)

  return (
    <OverlayTop onClose={onClose} label="Link a Show or Book">
      <ScreenHeaderTitle onClose={onClose}>
        <div className="flex-1">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search your Shows & Books"
          />
        </div>
      </ScreenHeaderTitle>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {results.map((c) => (
            <button
              key={`${c.kind}-${c.id}`}
              onClick={() => onSelect(c)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
            >
              <Thumb url={c.thumbUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-text-primary">
                  {c.title}
                  {c.year ? ` (${c.year})` : ''}
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <StatusChip
                    label={KIND_LABEL[c.sourceType] ?? c.sourceType}
                    className="bg-input text-text-secondary"
                  />
                  {c.authors.length > 0 && (
                    <span className="truncate text-caption text-text-secondary">
                      {c.authors.join(', ')}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}

          {results.length === 0 && (
            <p className="px-4 py-6 text-center text-body text-text-tertiary">
              {loading
                ? 'Loading…'
                : error
                  ? 'Couldn’t load your Shows & Books.'
                  : all.length === 0
                    ? 'You have no Shows or Books to link yet.'
                    : 'No matches.'}
            </p>
          )}
        </div>
      </div>
    </OverlayTop>
  )
}
