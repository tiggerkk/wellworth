import { useEffect, useState } from 'react'
import { IconWorldSearch, IconX } from '@tabler/icons-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { SearchBar } from './SearchBar'
import { externalFoodServing, searchFoods, type ExternalFood } from '../lib/food-api'
import { foodMatchScore } from '../lib/food-search'

type SearchError = 'failed' | null

interface FoodSearchSheetProps {
  onSelect: (result: ExternalFood) => void
  onClose: () => void
  /** Seed the search box (e.g. the importer row's food name) so results show on open. */
  initialQuery?: string
}

/** Rank USDA hits the same way the Add-Food "All" tab does: drop non-matches, best name match first,
 * then richer (more nutrients) first, then alphabetical. */
function rankFoods(results: ExternalFood[], query: string): ExternalFood[] {
  return results
    .map((f) => ({ f, score: foodMatchScore(f.name, query) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Object.keys(b.f.nutrients).length - Object.keys(a.f.nutrients).length ||
        a.f.name.localeCompare(b.f.name),
    )
    .map((x) => x.f)
}

/**
 * USDA food search — a **local** fixed overlay (not the routing `Sheet`, which would remount the
 * importer and lose its in-progress preview). Mirrors `BookSearchSheet`: a search bar over result
 * rows (name + "{N} nutrients · {serving}"); selecting a row hands the `ExternalFood` back via
 * `onSelect`. Used by the food importer's "Change" action.
 */
export function FoodSearchSheet({
  onSelect,
  onClose,
  initialQuery = '',
}: FoodSearchSheetProps) {
  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery)
  const [results, setResults] = useState<ExternalFood[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<SearchError>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400)
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
    let cancelled = false
    setLoading(true)
    setError(null)
    /* eslint-enable react-hooks/set-state-in-effect */
    searchFoods(term)
      .then((r) => {
        if (!cancelled) setResults(rankFoods(r, term))
      })
      .catch(() => {
        if (!cancelled) setError('failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced])

  useEscapeKey(onClose)

  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search foods"
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
              placeholder="Search USDA by name"
              icon={IconWorldSearch}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {results.map((f) => (
              <button
                key={`${f.source}-${f.externalId}`}
                onClick={() => onSelect(f)}
                className="flex w-full flex-col items-start px-3 py-2.5 text-left active:bg-input/40"
              >
                <span className="break-words text-[15px] text-text-primary">
                  {f.name}
                </span>
                <span className="mt-0.5 text-xs text-text-secondary">
                  {Object.keys(f.nutrients).length} nutrients · {externalFoodServing(f)}
                  {f.brand ? ` · ${f.brand}` : ''}
                </span>
              </button>
            ))}

            {results.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-tertiary">
                {!debounced.trim()
                  ? 'Search USDA by name.'
                  : loading
                    ? 'Searching…'
                    : error === 'failed'
                      ? 'Search failed.'
                      : 'No matches.'}
              </p>
            )}
          </div>

          {error === 'failed' && (
            <p className="mt-3 text-xs text-danger">
              Food search unavailable — is <code>VITE_USDA_API_KEY</code> set?
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
