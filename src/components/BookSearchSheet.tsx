import { useEffect, useState } from 'react'
import { IconWorldSearch, IconX } from '@tabler/icons-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { SearchBar } from './SearchBar'
import { CoverThumb } from './CoverThumb'
import {
  BookSearchRateLimitError,
  rankSearchResults,
  searchBooks,
  type BookSearchResult,
} from '../lib/books-api'

type SearchError = 'rate' | 'quota' | 'failed' | null

interface BookSearchSheetProps {
  onSelect: (result: BookSearchResult) => void
  onClose: () => void
  /** Seed the search box (e.g. the Entry form's current Title) so results show on open. */
  initialQuery?: string
  /** Author used **only** to rank results (does not change the typed query); e.g. the draft author. */
  authorHint?: string | null
}

/**
 * Google Books / Open Library title search — a **local** fixed overlay (not the routing `Sheet`,
 * which would put the Entry form behind a background-location and remount it, losing the in-progress
 * draft). Mirrors the Shows `TitleSearchSheet`; selecting a result hands it back via `onSelect` to
 * populate the live form. The Google key is optional, so a failure is network/quota — not a missing key.
 */
export function BookSearchSheet({
  onSelect,
  onClose,
  initialQuery = '',
  authorHint = null,
}: BookSearchSheetProps) {
  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery)
  const [results, setResults] = useState<BookSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<SearchError>(null)

  // A longer debounce keeps the keyless Google Books quota from 429-ing on every keystroke pause.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 600)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const term = debounced.trim()
    if (!term) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }
    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    searchBooks(term, { signal: controller.signal })
      .then((r) => {
        if (!cancelled)
          setResults(rankSearchResults(r, { title: term, author: authorHint }))
      })
      .catch((e) => {
        if (cancelled || controller.signal.aborted) return
        setError(
          e instanceof BookSearchRateLimitError ? (e.daily ? 'quota' : 'rate') : 'failed',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    // Cancelling the in-flight request (not just ignoring it) saves quota when you keep typing.
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debounced, authorHint])

  useEscapeKey(onClose)

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search books"
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
              placeholder="Search by title or author"
              icon={IconWorldSearch}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {results.map((r) => (
              <button
                key={`${r.source}-${r.sourceId}`}
                onClick={() => onSelect(r)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
              >
                <CoverThumb url={r.coverUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-text-primary">
                    {r.title}
                    {r.year ? ` (${r.year})` : ''}
                  </span>
                  {r.authors?.length ? (
                    <span className="mt-0.5 block truncate text-caption text-text-secondary">
                      {r.authors.join(', ')}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}

            {results.length === 0 && (
              <p className="px-4 py-6 text-center text-body text-text-tertiary">
                {!debounced.trim()
                  ? 'Search Google Books by title or author.'
                  : loading
                    ? 'Searching…'
                    : error === 'rate'
                      ? 'Too many searches — pause a moment.'
                      : error === 'quota'
                        ? 'Daily Google Books quota reached.'
                        : error === 'failed'
                          ? 'Search failed.'
                          : 'No matches.'}
              </p>
            )}
          </div>

          {error === 'rate' && (
            <p className="mt-3 text-caption text-danger">
              Rate-limited by Google Books — pause a moment, or add a (free) Google Books
              API key for higher limits.
            </p>
          )}
          {error === 'quota' && (
            <p className="mt-3 text-caption text-danger">
              Daily Google Books quota exhausted — it resets at midnight US-Pacific. Raise
              the project’s “Queries per day” limit in Google Cloud for more.
            </p>
          )}
          {error === 'failed' && (
            <p className="mt-3 text-caption text-danger">
              Book search unavailable — please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
