import { useCallback, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { listShows } from '../data/show'
import { listBooks } from '../data/book'
import { posterUrl } from '../lib/shows'
import { filterLinkCandidates, type LinkCandidate } from '../lib/quotes'
import type { QuoteSourceType } from '../constants/quotes'
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

interface QuoteSourceLinkSheetProps {
  onSelect: (candidate: LinkCandidate) => void
  onClose: () => void
}

/**
 * Cross-module source linker — a **local** fixed overlay (not the routing `Sheet`, which would put
 * the Entry form behind a background-location and remount it, losing the in-progress draft; same
 * lesson as Shows `TitleSearchSheet` / Books `BookSearchSheet`). Searches the user's own `show` +
 * `book` rows (no external API); selecting one hands a `LinkCandidate` back via `onSelect`.
 */
export function QuoteSourceLinkSheet({ onSelect, onClose }: QuoteSourceLinkSheetProps) {
  const { session } = useAuth()
  const userId = session?.user.id
  const [query, setQuery] = useState('')

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
  useEscapeKey(onClose)

  const all = candidates ?? []
  const results = filterLinkCandidates(all, query)

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Link a Show or Book"
        className="absolute inset-0 flex flex-col bg-surface pt-[env(safe-area-inset-top)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button onClick={onClose} aria-label="Close" className="shrink-0">
            <IconX size={22} className="text-text-secondary" />
          </button>
          <div className="flex-1">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search your Shows & Books"
            />
          </div>
        </div>

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
                  <span className="block truncate text-[15px] text-text-primary">
                    {c.title}
                    {c.year ? ` (${c.year})` : ''}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <StatusChip
                      label={KIND_LABEL[c.sourceType] ?? c.sourceType}
                      className="bg-input text-text-secondary"
                    />
                    {c.authors.length > 0 && (
                      <span className="truncate text-xs text-text-secondary">
                        {c.authors.join(', ')}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}

            {results.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-tertiary">
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
      </div>
    </div>
  )
}
