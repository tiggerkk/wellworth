import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { IconFilter, IconX } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { bumpQuotes, useQuotesVersion } from '../lib/quotes-refresh'
import { deleteQuote, listQuotes } from '../data/quote'
import {
  applyLibraryView,
  DEFAULT_LIBRARY_CRITERIA,
  quoteTags,
  QUOTE_CATEGORY_CHIP,
  type LibraryCriteria,
} from '../lib/quotes'
import {
  categoryLabel,
  effectiveCategories,
  effectiveSourceTypes,
} from '../lib/quotes-config'
import { QUOTE_LANGUAGES, QUOTE_LANGUAGE_LABELS } from '../constants/quotes'
import { routes } from '../constants/routes'
import { SearchBar } from '../components/SearchBar'
import { SwipeRow } from '../components/SwipeRow'
import { SelectMenu } from '../components/SelectMenu'
import { Toggle } from '../components/Toggle'
import { StatusChip } from '../components/StatusChip'

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All languages' },
  ...QUOTE_LANGUAGES.map((l) => ({ value: l, label: QUOTE_LANGUAGE_LABELS[l] })),
]

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

  const [criteria, setCriteria] = useState<LibraryCriteria>(DEFAULT_LIBRARY_CRITERIA)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const setCrit = (patch: Partial<LibraryCriteria>) =>
    setCriteria((c) => ({ ...c, ...patch }))

  const fn = useCallback(() => {
    void version // refetch after a create/edit/delete (bumpQuotes)
    if (!userId) return Promise.resolve([])
    return listQuotes(userId)
  }, [userId, version])
  const { data: quotes, loading, error } = useAsync(fn)

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
      { value: 'all', label: 'All categories' },
      ...categories.map((c) => ({ value: c.key, label: c.label })),
    ],
    [categories],
  )
  const sourceOptions = useMemo(
    () => [
      { value: 'all', label: 'All sources' },
      ...sourceTypes.map((s) => ({ value: s.key, label: s.label })),
    ],
    [sourceTypes],
  )

  async function remove(id: string) {
    if (!confirm('Delete this quote? This can’t be undone.')) return
    await deleteQuote(id)
    bumpQuotes()
  }

  function clearFilters() {
    setCriteria((c) => ({ ...DEFAULT_LIBRARY_CRITERIA, query: c.query }))
  }
  function toggleTag(tag: string) {
    setCriteria((c) => ({
      ...c,
      tags: c.tags.includes(tag) ? c.tags.filter((t) => t !== tag) : [...c.tags, tag],
    }))
  }

  const all = quotes ?? []
  const tagOptions = quoteTags(all)
  // The URL constraint is layered on at view time so the panel state stays purely local.
  const view = applyLibraryView(all, { ...criteria, showId, bookId })

  const activeCount =
    (criteria.category !== 'all' ? 1 : 0) +
    (criteria.tags.length > 0 ? 1 : 0) +
    (criteria.favoritesOnly ? 1 : 0) +
    (criteria.sourceType !== 'all' ? 1 : 0) +
    (criteria.language !== 'all' ? 1 : 0)

  const constrained = !!(showId || bookId)
  const constraintTitle = constrained
    ? (all.find(
        (q) => (showId && q.show_id === showId) || (bookId && q.book_id === bookId),
      )?.title ?? 'this title')
    : null

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <SearchBar
          value={criteria.query}
          onChange={(q) => setCrit({ query: q })}
          placeholder="Search quotes, author, tags"
        />
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex items-center gap-1 self-start rounded-input bg-input px-2.5 py-1.5 text-sm text-text-primary"
        >
          <IconFilter size={15} /> Filters
          {activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
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
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <SelectMenu
                value={criteria.category}
                options={categoryOptions}
                onChange={(v) => setCrit({ category: v })}
              />
            </Field>
            <Field label="Source type">
              <SelectMenu
                value={criteria.sourceType}
                options={sourceOptions}
                onChange={(v) => setCrit({ sourceType: v })}
              />
            </Field>
            <Field label="Language">
              <SelectMenu
                value={criteria.language}
                options={LANGUAGE_OPTIONS}
                onChange={(v) => setCrit({ language: v as LibraryCriteria['language'] })}
              />
            </Field>
            <label className="flex items-center justify-between self-end py-1.5">
              <span className="text-text-secondary">Favourites only</span>
              <Toggle
                checked={criteria.favoritesOnly}
                onChange={(v) => setCrit({ favoritesOnly: v })}
                label="Favourites only"
              />
            </label>
          </div>

          {tagOptions.length > 0 && (
            <Field label="Tags">
              <div className="flex flex-wrap gap-1.5">
                {tagOptions.map((tag) => {
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
              </div>
            </Field>
          )}

          {activeCount > 0 && (
            <button onClick={clearFilters} className="self-start text-accent">
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-text-secondary">Loading…</p>}
      {error && <p className="text-sm text-danger">Couldn’t load your quotes.</p>}
      {!loading && !error && view.length === 0 && (
        <p className="py-16 text-center text-sm text-text-secondary">
          {all.length > 0 ? 'No quotes match.' : 'No quotes yet. Add one to get started.'}
        </p>
      )}

      {!loading && !error && view.length > 0 && (
        <div className="overflow-hidden rounded-card border border-border">
          {view.map((quote) => (
            <SwipeRow key={quote.id} onDelete={() => void remove(quote.id)}>
              <button
                onClick={() => navigate(routes.quotes.edit(quote.id))}
                className="block w-full border-b border-border px-3 py-3 text-left last:border-b-0"
              >
                <span className="line-clamp-2 text-[15px] text-text-primary">
                  {quote.text}
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
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-text-secondary">{label}</p>
      {children}
    </div>
  )
}
