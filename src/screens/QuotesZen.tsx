import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  IconArrowsShuffle,
  IconHeart,
  IconHeartFilled,
  IconPlus,
} from '@tabler/icons-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { useProfile } from '../hooks/useProfile'
import { listQuotes, updateQuote } from '../data/quote'
import {
  initialZenPool,
  nextZenPool,
  randomItem,
  QUOTE_CATEGORY_CHIP,
  type QuoteRow,
} from '../lib/quotes'
import {
  categoryLabel,
  effectiveCategories,
  effectiveSourceTypes,
  sourceTypeLabel,
  type QuoteCategoryConfig,
  type QuoteSourceTypeConfig,
} from '../lib/quotes-config'
import { bumpQuotes, useQuotesVersion } from '../lib/quotes-refresh'
import { routes } from '../constants/routes'
import { StatusChip } from '../components/StatusChip'

const PULL_THRESHOLD = 60 // px of (damped) pull past which release triggers a shuffle
const PULL_MAX = 90

/**
 * Quotes — Moment of Zen (`/quotes`). One random quote: favourites first on load, broadening to the
 * whole pool on refresh with no immediate repeat. Refreshed by a Shuffle button (works everywhere)
 * or a hand-rolled pull-to-refresh gesture (touch). Tapping a linked Title jumps to the Show/Book.
 */
export function QuotesZen() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id
  const version = useQuotesVersion()

  const fn = useCallback(() => {
    void version // refetch after a favourite toggle / entry edit (bumpQuotes)
    if (!userId) return Promise.resolve([])
    return listQuotes(userId)
  }, [userId, version])
  const { data: quotes, loading, error } = useAsync(fn)

  // Source-type / category labels are owner-configurable — resolve via the profile lists (tolerant).
  const { data: profile } = useProfile()
  const sourceTypes = useMemo(
    () => effectiveSourceTypes(profile?.quote_source_types ?? null),
    [profile],
  )
  const categories = useMemo(
    () => effectiveCategories(profile?.quote_categories ?? null),
    [profile],
  )

  const [currentId, setCurrentId] = useState<string | null>(null)
  // Optimistic favourite overrides so the heart flips instantly (reconciled by the refetch).
  const [favOverride, setFavOverride] = useState<Record<string, boolean>>({})

  // Pick the initial quote when data arrives; keep the current one if it's still in the list (so a
  // favourite toggle / refetch doesn't jump the card).
  useEffect(() => {
    if (!quotes || quotes.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentId((prev) =>
      prev && quotes.some((q) => q.id === prev)
        ? prev
        : (randomItem(initialZenPool(quotes))?.id ?? null),
    )
  }, [quotes])

  const all = useMemo(() => quotes ?? [], [quotes])
  const current = all.find((q) => q.id === currentId) ?? null

  const shuffle = useCallback(() => {
    const pick = randomItem(nextZenPool(all, currentId))
    if (pick) setCurrentId(pick.id)
  }, [all, currentId])

  async function toggleFavorite(q: QuoteRow) {
    const next = !(favOverride[q.id] ?? q.is_favorite)
    setFavOverride((o) => ({ ...o, [q.id]: next }))
    try {
      await updateQuote(q.id, { is_favorite: next })
      bumpQuotes()
    } catch {
      setFavOverride((o) => ({ ...o, [q.id]: !next })) // revert on failure
    }
  }

  // --- Pull-to-refresh (Pointer Events, mirroring SwipeRow) ---
  const scrollRef = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)
  const active = useRef(false)
  const [pull, setPull] = useState(0)
  const [dragging, setDragging] = useState(false)

  function onPointerDown(e: React.PointerEvent) {
    startY.current = e.clientY
    active.current = false
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startY.current === null) return
    const dy = e.clientY - startY.current
    if (!active.current) {
      // Engage only when pulling down from the very top of the scroll area.
      if (dy <= 8 || (scrollRef.current?.scrollTop ?? 0) > 0) return
      active.current = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setPull(Math.min(PULL_MAX, dy * 0.5))
  }
  function onPointerUp() {
    if (active.current && pull > PULL_THRESHOLD) shuffle()
    setPull(0)
    setDragging(false)
    active.current = false
    startY.current = null
  }

  return (
    <div className="flex h-full flex-col">
      {loading && <p className="px-4 py-6 text-sm text-text-secondary">Loading…</p>}
      {error && (
        <p className="px-4 py-6 text-sm text-danger">Couldn’t load your quotes.</p>
      )}

      {!loading && !error && all.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-text-secondary">
          <p className="text-sm">No quotes yet.</p>
          <button
            onClick={() => navigate(routes.quotes.entry)}
            className="flex items-center gap-1 rounded-pill bg-input px-3 py-1.5 text-sm text-accent"
          >
            <IconPlus size={16} /> Add a quote
          </button>
        </div>
      )}

      {!loading && !error && current && (
        <div
          ref={scrollRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative flex-1 overflow-y-auto"
          style={{ touchAction: 'pan-y' }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-2 flex justify-center"
            style={{ opacity: Math.min(pull / PULL_THRESHOLD, 1) }}
          >
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <IconArrowsShuffle size={14} />
              {pull > PULL_THRESHOLD ? 'Release to shuffle' : 'Pull to shuffle'}
            </span>
          </div>

          <div
            className="flex min-h-full items-center justify-center"
            style={{
              transform: `translateY(${pull}px)`,
              transition: dragging ? 'none' : 'transform 200ms ease-out',
            }}
          >
            <QuoteCard
              quote={current}
              favorite={favOverride[current.id] ?? current.is_favorite}
              onToggleFavorite={() => void toggleFavorite(current)}
              sourceTypes={sourceTypes}
              categories={categories}
            />
          </div>

          <button
            onClick={shuffle}
            disabled={all.length === 0}
            aria-label="Shuffle"
            className="absolute right-4 bottom-4 z-10 flex items-center gap-1 rounded-pill bg-input px-3 py-1.5 text-sm text-accent shadow-sm disabled:opacity-40"
          >
            <IconArrowsShuffle size={18} /> Shuffle
          </button>
        </div>
      )}
    </div>
  )
}

function QuoteCard({
  quote,
  favorite,
  onToggleFavorite,
  sourceTypes,
  categories,
}: {
  quote: QuoteRow
  favorite: boolean
  onToggleFavorite: () => void
  sourceTypes: QuoteSourceTypeConfig[]
  categories: QuoteCategoryConfig[]
}) {
  const sourceLabel = sourceTypeLabel(sourceTypes, quote.source_type)
  const titleNode = quote.title ? (
    quote.show_id ? (
      <Link to={routes.shows.edit(quote.show_id)} className="text-accent underline">
        {quote.title}
      </Link>
    ) : quote.book_id ? (
      <Link to={routes.books.edit(quote.book_id)} className="text-accent underline">
        {quote.title}
      </Link>
    ) : (
      <span>{quote.title}</span>
    )
  ) : null

  const meta = [
    quote.author ? <span key="author">{quote.author}</span> : null,
    <span key="source">{sourceLabel}</span>,
    titleNode ? <span key="title">{titleNode}</span> : null,
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-md px-6 py-10 text-center">
      <p className="text-2xl leading-relaxed font-medium break-words whitespace-pre-line text-text-primary">
        {quote.text}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-text-secondary">
        {meta.map((node, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden className="text-text-tertiary">
                ·
              </span>
            )}
            {node}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <StatusChip
          label={categoryLabel(categories, quote.category)}
          className={QUOTE_CATEGORY_CHIP}
        />
        {quote.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-pill bg-input px-2 py-0.5 text-xs text-text-secondary"
          >
            {tag}
          </span>
        ))}
      </div>

      <button
        onClick={onToggleFavorite}
        aria-label="Favourite"
        className="mt-6 inline-flex"
      >
        {favorite ? (
          <IconHeartFilled size={26} className="text-accent" />
        ) : (
          <IconHeart size={26} className="text-text-tertiary" />
        )}
      </button>
    </div>
  )
}
