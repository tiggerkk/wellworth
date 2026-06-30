import { useEffect, useState } from 'react'
import { IconWorldSearch, IconX } from '@tabler/icons-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { SearchBar } from './SearchBar'
import { ShowTypeBadge } from './ShowTypeBadge'
import { PosterThumb } from './PosterThumb'
import {
  parseTitleYear,
  rankTitleResults,
  searchTitles,
  type TmdbSearchResult,
} from '../lib/tmdb-api'
import { SHOW_TYPE_LABELS, type ShowType } from '../lib/shows'

interface TitleSearchSheetProps {
  type: ShowType
  onSelect: (result: TmdbSearchResult) => void
  onClose: () => void
  /** Seed the search box (e.g. the Entry form's current Title) so results show on open. */
  initialQuery?: string
  /** Year used **only** to rank results (does not change the typed query); e.g. the draft year. */
  yearHint?: number | null
}

/**
 * TMDB title search — a **local** fixed overlay (not the routing `Sheet`, which would put the
 * Entry form behind a background-location and remount it, losing the in-progress draft). Mirrors
 * the Add Food search UI; selecting a result hands it back via `onSelect` to populate the live form.
 */
export function TitleSearchSheet({
  type,
  onSelect,
  onClose,
  initialQuery = '',
  yearHint = null,
}: TitleSearchSheetProps) {
  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery)
  const [results, setResults] = useState<TmdbSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const term = debounced.trim()
    if (!term) {
      setResults([])
      setLoading(false)
      setError(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    /* eslint-enable react-hooks/set-state-in-effect */
    // Tolerate a "(YYYY)" suffix in the typed term too; rank by title (+ year hint, or the year
    // parsed off the term) so the best match floats to the top.
    const { title, year } = parseTitleYear(term)
    searchTitles(type, title)
      .then((r) => {
        if (!cancelled) setResults(rankTitleResults(r, { title, year: yearHint ?? year }))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [type, debounced, yearHint])

  useEscapeKey(onClose)

  const typeLabel = SHOW_TYPE_LABELS[type]

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search titles"
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
              placeholder={`Search ${typeLabel} titles`}
              icon={IconWorldSearch}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {results.map((r) => {
              return (
                <button
                  key={`${r.type}-${r.tmdbId}`}
                  onClick={() => onSelect(r)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-input/40"
                >
                  <PosterThumb path={r.posterPath} size="w92" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text-primary">
                      {r.title}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-caption text-text-secondary">
                      <ShowTypeBadge type={r.type} />
                      {r.year ?? '—'}
                    </span>
                  </span>
                </button>
              )
            })}

            {results.length === 0 && (
              <p className="px-4 py-6 text-center text-body text-text-tertiary">
                {!debounced.trim()
                  ? `Search TMDB for a ${typeLabel.toLowerCase()}.`
                  : loading
                    ? 'Searching…'
                    : error
                      ? 'Search failed.'
                      : 'No matches.'}
              </p>
            )}
          </div>

          {error && (
            <p className="mt-3 text-caption text-danger">
              Title search unavailable — is VITE_TMDB_API_KEY set?
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
