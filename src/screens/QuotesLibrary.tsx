import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { IconQuote, IconX } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { useSessionState } from '../hooks/useSessionState'
import { bumpQuotes, useQuotesVersion } from '../lib/quotes-refresh'
import { deleteQuote, listQuotes, updateQuote } from '../data/quote'
import {
  applyLibraryView,
  DEFAULT_LIBRARY_CRITERIA,
  rankedTags,
  type LibraryCriteria,
  type SortField,
} from '../lib/quotes'
import { foldZh } from '../lib/zh-fold'
import {
  categoryColor,
  categoryLabel,
  effectiveCategories,
  effectiveSourceTypes,
} from '../lib/quotes-config'
import { QUOTE_LANGUAGES, QUOTE_LANGUAGE_LABELS } from '../constants/quotes'
import { routes } from '../constants/routes'
import { ListRow } from '../components/ListRow'
import { EmptyState } from '../components/EmptyState'
import { SelectMenu } from '../components/SelectMenu'
import { Toggle } from '../components/Toggle'
import { LabelChip } from '../components/LabelChip'
import { ListSearchFilterPanel, ResultCount } from '../components/ListSearchFilterPanel'
import { FilterPill } from '../components/FilterPill'

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
  const {
    data: quotes,
    loading,
    error,
  } = useAsync(fn, undefined, userId ? { key: `quotes:${userId}`, version } : undefined)

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

  async function toggleFavorite(id: string, next: boolean) {
    setOverride((prev) =>
      (prev ?? quotes ?? []).map((q) => (q.id === id ? { ...q, is_favorite: next } : q)),
    )
    try {
      await updateQuote(id, { is_favorite: next })
    } catch {
      bumpQuotes() // resync from server on a failed write
    }
  }

  function clearFilters() {
    setCriteria(() => ({
      ...DEFAULT_LIBRARY_CRITERIA,
      //query: c.query,
      //sortField: c.sortField,
      //sortDir: c.sortDir,
    }))
    setTagQuery('')
  }
  function toggleTag(tag: string) {
    setCriteria((c) => ({
      ...c,
      tags: c.tags.includes(tag) ? c.tags.filter((t) => t !== tag) : [...c.tags, tag],
    }))
  }

  const all = useMemo(() => override ?? quotes ?? [], [override, quotes])
  // Tags ranked by quote count (most-used first). By default the facet shows the top N; once there are
  // more, a search box narrows the FULL list. Selected tags always stay visible (so they're deselectable).
  // Memoized: rankedTags counts+sorts every distinct tag across every quote, so without this it reran on
  // every render (including every keystroke in Search or the tag-filter box), not just when `all` changes.
  const ranked = useMemo(() => rankedTags(all), [all])
  const showTagSearch = ranked.length > TOP_TAGS
  const tagFilter = foldZh(tagQuery.trim())
  const pool = tagFilter
    ? ranked.filter((r) => foldZh(r.tag).includes(tagFilter)).map((r) => r.tag)
    : ranked.slice(0, TOP_TAGS).map((r) => r.tag)
  const displayTags = [
    ...criteria.tags.filter((t) => !tagFilter || foldZh(t).includes(tagFilter)),
    ...pool.filter((t) => !criteria.tags.includes(t)),
  ]
  const constrained = !!(showId || bookId)
  const constraintTitle = constrained
    ? (all.find(
        (q) => (showId && q.show_id === showId) || (bookId && q.book_id === bookId),
      )?.title ?? 'this title')
    : null

  return (
    <div className="flex min-h-full flex-col gap-3 px-4 py-4">
      <ListSearchFilterPanel
        sticky
        query={criteria.query}
        onQueryChange={(q) => setCrit({ query: q })}
        placeholder="Search quote, author, title, tag"
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        sortField={criteria.sortField}
        sortOptions={SORT_OPTIONS}
        onSortFieldChange={(f) => setCrit({ sortField: f })}
        sortDir={criteria.sortDir}
        onToggleSortDir={() =>
          setCrit({ sortDir: criteria.sortDir === 'asc' ? 'desc' : 'asc' })
        }
        onClearFilters={clearFilters}
        hasActiveFilters={
          JSON.stringify(criteria) !== JSON.stringify(DEFAULT_LIBRARY_CRITERIA)
        }
        extra={
          <span className="flex items-center gap-1.5">
            <span className="text-caption text-text-secondary">Favorites Only</span>
            <Toggle
              checked={criteria.favoritesOnly}
              onChange={(v) => setCrit({ favoritesOnly: v })}
              label="Favorites Only"
            />
          </span>
        }
        afterSearch={
          constrained && (
            <div className="flex items-center justify-between rounded-input bg-input px-3 py-2 text-body">
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
          )
        }
        filters={
          <>
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
                <span className="text-text-secondary">Linked Titles Only</span>
                <Toggle
                  checked={criteria.linkedOnly}
                  onChange={(v) => setCrit({ linkedOnly: v })}
                  label="Linked Titles Only"
                />
              </label>
            </div>

            {showTagSearch && (
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Filter tags…"
                aria-label="Filter tags"
                className="field-control w-full"
              />
            )}

            {ranked.length > 0 && (
              <div className="flex max-h-32 flex-wrap items-center gap-1.5 overflow-y-auto">
                {displayTags.map((tag) => (
                  <FilterPill
                    key={tag}
                    label={tag}
                    selected={criteria.tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  />
                ))}
                {displayTags.length === 0 && (
                  <span className="text-text-tertiary">No tags match.</span>
                )}
                {showTagSearch && !tagFilter && (
                  <span className="text-text-tertiary">· top {TOP_TAGS} by use</span>
                )}
              </div>
            )}
          </>
        }
        loading={loading}
        error={error}
        data={override ?? quotes}
        errorText="Couldn’t load your quotes."
        emptyState={
          <EmptyState
            title="No quotes yet"
            actionLabel="New Quote"
            to={routes.quotes.entry}
            Icon={IconQuote}
          />
        }
      >
        {(allLoaded) => {
          // The URL constraint is layered on at view time so the panel state stays purely local.
          const view = applyLibraryView(allLoaded, { ...criteria, showId, bookId })
          if (view.length === 0) {
            return (
              <p className="py-16 text-center text-body text-text-secondary">
                No quotes match.
              </p>
            )
          }
          return (
            <>
              <ResultCount count={view.length} />
              <div className="flex flex-col gap-2">
                {view.map((quote) => (
                  <ListRow
                    key={quote.id}
                    color={categoryColor(categories, quote.category)}
                    isFavorite={quote.is_favorite}
                    onToggleFavorite={() =>
                      void toggleFavorite(quote.id, !quote.is_favorite)
                    }
                    onDelete={() => void remove(quote.id)}
                    onClick={() => navigate(routes.quotes.edit(quote.id))}
                  >
                    <span className="line-clamp-2 block text-body text-text-primary">
                      {quote.text}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                      <LabelChip
                        label={categoryLabel(categories, quote.category)}
                        color={categoryColor(categories, quote.category)}
                      />
                      {quote.author && <span className="truncate">{quote.author}</span>}
                    </span>
                  </ListRow>
                ))}
              </div>
            </>
          )
        }}
      </ListSearchFilterPanel>
    </div>
  )
}
