import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { IconHeartFilled, IconQuote, IconX } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useSessionState } from '../hooks/useSessionState'
import { bumpQuotes, useQuotesVersion } from '../lib/quotes-refresh'
import { deleteQuote, listQuotes } from '../data/quote'
import {
  applyLibraryView,
  DEFAULT_LIBRARY_CRITERIA,
  rankedTags,
  QUOTE_CATEGORY_CHIP,
  type LibraryCriteria,
  type SortField,
} from '../lib/quotes'
import { foldZh } from '../lib/zh-fold'
import {
  categoryLabel,
  effectiveCategories,
  effectiveSourceTypes,
} from '../lib/quotes-config'
import { QUOTE_LANGUAGES, QUOTE_LANGUAGE_LABELS } from '../constants/quotes'
import { routes } from '../constants/routes'
import { SearchBar } from '../components/SearchBar'
import { SwipeRow } from '../components/SwipeRow'
import { EmptyState } from '../components/EmptyState'
import { SelectMenu } from '../components/SelectMenu'
import { Toggle } from '../components/Toggle'
import { StatusChip } from '../components/StatusChip'
import { FilterToggleButton } from '../components/FilterToggleButton'
import { FilterPanel } from '../components/FilterPanel'
import { SortControl } from '../components/SortControl'
import { ResultCount } from '../components/ResultCount'

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Any Language' },
  ...QUOTE_LANGUAGES.map((l) => ({ value: l, label: QUOTE_LANGUAGE_LABELS[l] })),
]
const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'category', label: 'Category' },
  { value: 'sourceType', label: 'Source Type' },
]
// The tag facet shows this many most-used tags by default; above it, a search box finds the rest.
const TOP_TAGS = 10

/**
 * Quotes — Library. Real-time search over text/author/title/tags + a collapsible faceted filter
 * panel (Category / multi-select Tags / Favourites / Source type / Language). Opening with a
 * `?show=`/`?book=` param constrains the list to that record's quotes ("Quotes from this title").
 */
export function QuotesLibrary() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useQuotesVersion()
  const [params] = useSearchParams()
  const showId = params.get('show')
  const bookId = params.get('book')

  const [criteria, setCriteria] = useSessionState<LibraryCriteria>(
    'wellworth:quotes-library',
    DEFAULT_LIBRARY_CRITERIA,
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState('')
  const setCrit = (patch: Partial<LibraryCriteria>) =>
    setCriteria((c) => ({ ...c, ...patch }))

  const fn = useCallback(() => {
    void version // refetch after a create/edit/delete (bumpQuotes)
    if (!userId) return Promise.resolve([])
    return listQuotes(userId)
  }, [userId, version])
  const { data: quotes, loading, error } = useAsync(fn)

  // Optimistic delete: drop the row locally so it disappears instantly, instead of waiting for a
  // `bumpQuotes()` → full-library refetch. Override resets when a real fetch lands (adjust-state-
  // during-render, not an effect — see tech-spec F16b).
  const [override, setOverride] = useState<typeof quotes>(undefined)
  const [syncedQuotes, setSyncedQuotes] = useState(quotes)
  if (syncedQuotes !== quotes) {
    setSyncedQuotes(quotes)
    setOverride(undefined)
  }

  // Category / Source-type values are owner-configurable (Quotes Settings) — derive options + labels
  // from the profile lists (NULL ⇒ canonical defaults), tolerant of orphaned keys.
  const { data: profile } = useProfile()
  const categories = useMemo(
    () => effectiveCategories(profile?.quote_categories ?? null),
    [profile],
  )
  const sourceTypes = useMemo(
    () => effectiveSourceTypes(profile?.quote_source_types ?? null),
    [profile],
  )
  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'Any Category' },
      ...categories.map((c) => ({ value: c.key, label: c.label })),
    ],
    [categories],
  )
  const sourceOptions = useMemo(
    () => [
      { value: 'all', label: 'Any Source' },
      ...sourceTypes.map((s) => ({ value: s.key, label: s.label })),
    ],
    [sourceTypes],
  )

  async function remove(id: string) {
    setOverride((prev) => (prev ?? quotes ?? []).filter((q) => q.id !== id))
    try {
      await deleteQuote(id)
    } catch {
      bumpQuotes() // resync from server on a failed delete
    }
  }

  function clearFilters() {
    setCriteria((c) => ({
      ...DEFAULT_LIBRARY_CRITERIA,
      query: c.query,
      sortField: c.sortField,
      sortDir: c.sortDir,
    }))
    setTagQuery('')
  }
  function toggleTag(tag: string) {
    setCriteria((c) => ({
      ...c,
      tags: c.tags.includes(tag) ? c.tags.filter((t) => t !== tag) : [...c.tags, tag],
    }))
  }

  const all = override ?? quotes ?? []
  // Tags ranked by quote count (most-used first). By default the facet shows the top N; once there are
  // more, a search box narrows the FULL list. Selected tags always stay visible (so they're deselectable).
  const ranked = rankedTags(all)
  const showTagSearch = ranked.length > TOP_TAGS
  const tagFilter = foldZh(tagQuery.trim())
  const pool = tagFilter
    ? ranked.filter((r) => foldZh(r.tag).includes(tagFilter)).map((r) => r.tag)
    : ranked.slice(0, TOP_TAGS).map((r) => r.tag)
  const displayTags = [
    ...criteria.tags.filter((t) => !tagFilter || foldZh(t).includes(tagFilter)),
    ...pool.filter((t) => !criteria.tags.includes(t)),
  ]
  // The URL constraint is layered on at view time so the panel state stays purely local.
  const view = applyLibraryView(all, { ...criteria, showId, bookId })

  const constrained = !!(showId || bookId)
  const constraintTitle = constrained
    ? (all.find(
        (q) => (showId && q.show_id === showId) || (bookId && q.book_id === bookId),
      )?.title ?? 'this title')
    : null

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <SearchBar
            value={criteria.query}
            onChange={(q) => setCrit({ query: q })}
            placeholder="Search quote, author, title, tag"
            className="min-w-0 flex-1"
          />
          <FilterToggleButton
            active={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          />
        </div>
      </div>

      {constrained && (
        <div className="flex items-center justify-between rounded-input bg-input px-3 py-2 text-sm">
          <span className="min-w-0 truncate text-text-primary">
            Quotes from <span className="text-text-secondary">{constraintTitle}</span>
          </span>
          <button
            onClick={() => navigate(routes.quotes.library)}
            aria-label="Clear title filter"
            className="shrink-0 p-1 text-text-tertiary"
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {filtersOpen && (
        <FilterPanel>
          <div className="grid grid-cols-2 gap-3">
            <SelectMenu
              value={criteria.category}
              options={categoryOptions}
              onChange={(v) => setCrit({ category: v })}
            />
            <SelectMenu
              value={criteria.sourceType}
              options={sourceOptions}
              onChange={(v) => setCrit({ sourceType: v })}
            />
            <SelectMenu
              value={criteria.language}
              options={LANGUAGE_OPTIONS}
              onChange={(v) => setCrit({ language: v as LibraryCriteria['language'] })}
            />
            <label className="flex items-center justify-between self-end py-1.5">
              <span className="text-text-secondary">Favorites Only</span>
              <Toggle
                checked={criteria.favoritesOnly}
                onChange={(v) => setCrit({ favoritesOnly: v })}
                label="Favorites Only"
              />
            </label>
          </div>

          {/* Linked toggle + the tag search share one row to save vertical space. */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between py-1.5">
              <span className="text-text-secondary">Linked Titles Only</span>
              <Toggle
                checked={criteria.linkedOnly}
                onChange={(v) => setCrit({ linkedOnly: v })}
                label="Linked Titles Only"
              />
            </label>
            {showTagSearch && (
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Filter tags…"
                aria-label="Filter tags"
                className="field-control w-full self-center placeholder:text-text-tertiary"
              />
            )}
          </div>

          {ranked.length > 0 && (
            <div className="flex max-h-32 flex-wrap items-center gap-1.5 overflow-y-auto">
              {displayTags.map((tag) => {
                const on = criteria.tags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-pill px-2 py-0.5 text-xs ${
                      on ? 'bg-accent text-bg' : 'bg-input text-text-secondary'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
              {displayTags.length === 0 && (
                <span className="text-text-tertiary">No tags match.</span>
              )}
              {showTagSearch && !tagFilter && (
                <span className="text-text-tertiary">· top {TOP_TAGS} by use</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <SortControl
              field={criteria.sortField}
              options={SORT_OPTIONS}
              onFieldChange={(f) => setCrit({ sortField: f })}
              dir={criteria.sortDir}
              onToggleDir={() =>
                setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
              }
            />
            <button onClick={clearFilters} className="text-accent">
              Clear Filters
            </button>
          </div>
        </FilterPanel>
      )}

      {loading && <p className="text-sm text-text-secondary">Loading…</p>}
      {error && <p className="text-sm text-danger">Couldn’t load your quotes.</p>}
      {!loading && !error && view.length === 0 && all.length === 0 && (
        <EmptyState
          title="No quotes yet"
          actionLabel="New Quote"
          to={routes.quotes.entry}
          Icon={IconQuote}
        />
      )}
      {!loading && !error && view.length === 0 && all.length > 0 && (
        <p className="py-16 text-center text-sm text-text-secondary">No quotes match.</p>
      )}

      {!loading && !error && view.length > 0 && (
        <>
          <ResultCount count={view.length} />
          <div className="overflow-hidden rounded-card border border-border">
            {view.map((quote) => (
              <SwipeRow key={quote.id} onDelete={() => void remove(quote.id)}>
                <button
                  onClick={() => navigate(routes.quotes.edit(quote.id))}
                  className="block w-full border-b border-border px-3 py-3 text-left last:border-b-0"
                >
                  <span className="flex items-start gap-1.5 text-[15px] text-text-primary">
                    {quote.is_favorite && (
                      <IconHeartFilled
                        size={13}
                        className="mt-1 shrink-0 text-favorite"
                        aria-label="Favourite"
                      />
                    )}
                    <span className="line-clamp-2">{quote.text}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                    <StatusChip
                      label={categoryLabel(categories, quote.category)}
                      className={QUOTE_CATEGORY_CHIP}
                    />
                    {quote.author && <span className="truncate">{quote.author}</span>}
                  </span>
                </button>
              </SwipeRow>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
