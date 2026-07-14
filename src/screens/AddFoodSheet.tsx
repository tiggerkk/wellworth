import { Suspense, useEffect, useState } from 'react'
import { useLocation, useSearchParams, type Location } from 'react-router'
import { IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { lazyWithReload } from '../lib/lazy-with-reload'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { SearchBar } from '../components/SearchBar'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { listFoods, setFavorite } from '../data/food'
import {
  externalFoodServing,
  searchFoods,
  type ExternalFood,
} from '../lib/wellness-food-api'
import { foodMatchScore } from '../lib/wellness-food-search'
import { asNutrientMap } from '../lib/wellness-nutrients'
import { todayLocal } from '../lib/date'
import { routes } from '../constants/routes'

// Lazy-loaded so the ZXing barcode library is a separate chunk, fetched only when scanning.
const BarcodeScanner = lazyWithReload(() =>
  import('../components/BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
)

type Tab = 'favorites' | 'custom' | 'all'
const SOURCE_TAG: Record<string, string> = { usda: 'USDA', custom: 'Custom', off: 'OFF' }

/** A search-result row, normalized across local foods and USDA results. */
interface DisplayFood {
  key: string
  name: string
  nutrientCount: number
  serving: string
  source: string
  onOpen: () => void
  /** Present only for local foods, which are the only ones that can be (un)favorited. */
  favorite?: { isFavorite: boolean; toggle: () => void }
}

function localServing(nutrientBasis: string): string {
  return nutrientBasis === 'per_serving' ? '1 serving' : '100 g'
}

// These caches outlive the sheet's React tree. Opening a food (Food Detail) unmounts this
// sheet; clicking X / ADD navigates back and remounts it. Serving the last results
// from the cache lets the previous tab, search, and results reappear instantly instead of
// flashing empty while refetching. (Tab + search text are restored from the URL; see below.)
let localFoodsCache: Awaited<ReturnType<typeof listFoods>> | null = null
let usdaCache: { query: string; results: ExternalFood[] } | null = null

function parseTab(value: string | null): Tab {
  return value === 'all' || value === 'custom' || value === 'favorites'
    ? value
    : 'favorites'
}

export function AddFoodSheet() {
  const openSheet = useSheetNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const group = params.get('group') ?? 'snacks'
  const day = params.get('day') ?? todayLocal()
  const suffix = `?group=${group}&day=${day}`

  // Initial UI state comes from the URL so a back-navigation restores it; a fresh open
  // (no tab/q params) falls back to the Favorites default with an empty search.
  const [tab, setTab] = useState<Tab>(() => parseTab(params.get('tab')))
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [debounced, setDebounced] = useState(query)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350)
    return () => clearTimeout(t)
  }, [query])

  // Follow tab + search into the URL (replace, so keystrokes don't pile up history). The
  // entry left behind when opening Food Detail then carries them, so SheetCloseButton restores
  // them. We keep `location.state` (the painted background) intact across the replace.
  useEffect(() => {
    const desiredTab = tab === 'favorites' ? null : tab
    const desiredQuery = query || null
    if (params.get('tab') === desiredTab && params.get('q') === desiredQuery) return
    const next = new URLSearchParams(params)
    if (desiredTab) next.set('tab', desiredTab)
    else next.delete('tab')
    if (desiredQuery) next.set('q', desiredQuery)
    else next.delete('q')
    setParams(next, { replace: true, state: location.state as Location })
  }, [tab, query, params, setParams, location.state])

  // --- Local (Favorites / Custom / your foods) ---
  const [userFoods, setUserFoods] = useState(localFoodsCache)
  const [reloadNonce, setReloadNonce] = useState(0)
  useEffect(() => {
    let cancelled = false
    listFoods()
      .then((rows) => {
        if (cancelled) return
        localFoodsCache = rows
        setUserFoods(rows)
      })
      .catch(() => {
        /* keep the last-known foods on a transient read error */
      })
    return () => {
      cancelled = true
    }
  }, [reloadNonce])

  // --- USDA search (All tab only) ---
  const [usdaResults, setUsdaResults] = useState<ExternalFood[]>(() =>
    usdaCache && usdaCache.query === query.trim() ? usdaCache.results : [],
  )
  const [usdaLoading, setUsdaLoading] = useState(false)
  const [usdaError, setUsdaError] = useState(false)
  useEffect(() => {
    // Intentional synchronous resets: a tab/query change starts (or clears) a fetch, and we
    // seed cached results so they show before the network round-trip — same trade-off useAsync
    // makes when it flips to loading.
    /* eslint-disable react-hooks/set-state-in-effect */
    const term = debounced.trim()
    if (tab !== 'all' || !term) {
      setUsdaResults([])
      setUsdaLoading(false)
      setUsdaError(false)
      return
    }
    let cancelled = false
    setUsdaError(false)
    // Show cached results immediately while revalidating; otherwise show the spinner.
    if (usdaCache && usdaCache.query === term) {
      setUsdaResults(usdaCache.results)
      setUsdaLoading(false)
    } else {
      setUsdaLoading(true)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    searchFoods(term)
      .then((results) => {
        if (cancelled) return
        usdaCache = { query: term, results }
        setUsdaResults(results)
      })
      .catch(() => {
        if (!cancelled) setUsdaError(true)
      })
      .finally(() => {
        if (!cancelled) setUsdaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, debounced])

  const q = query.trim()

  async function toggleFav(id: string, next: boolean) {
    await setFavorite(id, next)
    setReloadNonce((n) => n + 1)
  }

  // Merge local foods (filtered by tab) and USDA results into one normalized list, then — when
  // there is a query — keep only the matches and order them by how well each name matches, with
  // same-name (and same-score) entries ordered by nutrient count, descending. With no query we
  // keep the source order (local foods newest-first; no USDA fetched).
  const localFoods = (userFoods ?? []).filter((f) => {
    if (tab === 'favorites') return f.is_favorite
    if (tab === 'custom') return f.source === 'custom'
    return true
  })
  const localResults: DisplayFood[] = localFoods.map((f) => ({
    key: `local-${f.id}`,
    name: f.name,
    nutrientCount: Object.keys(asNutrientMap(f.nutrients)).length,
    serving: localServing(f.nutrient_basis),
    source: SOURCE_TAG[f.source] ?? f.source,
    onOpen: () => openSheet(`${routes.wellness.food('local', f.id)}${suffix}`),
    favorite: {
      isFavorite: f.is_favorite,
      toggle: () => void toggleFav(f.id, !f.is_favorite),
    },
  }))
  // A USDA/OFF food the user already saved (favorited/logged/customized) shows as a local row;
  // drop its live USDA twin so it doesn't appear twice (the local row carries the custom servings).
  const cachedExternal = new Set(
    (userFoods ?? [])
      .filter((f) => f.external_id)
      .map((f) => `${f.source}:${f.external_id}`),
  )
  const usdaDisplay: DisplayFood[] =
    tab === 'all'
      ? usdaResults
          .filter((f) => !cachedExternal.has(`${f.source}:${f.externalId}`))
          .map((f) => ({
            key: `usda-${f.externalId}`,
            name: f.name,
            nutrientCount: Object.keys(f.nutrients).length,
            serving: externalFoodServing(f),
            source: SOURCE_TAG[f.source] ?? f.source.toUpperCase(),
            onOpen: () =>
              openSheet(`${routes.wellness.food(f.source, f.externalId)}${suffix}`),
          }))
      : []

  let results = [...localResults, ...usdaDisplay]
  if (q) {
    results = results
      .map((r) => ({ r, score: foodMatchScore(r.name, q) }))
      .filter((x) => x.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.r.nutrientCount - a.r.nutrientCount ||
          a.r.name.localeCompare(b.r.name),
      )
      .map((x) => x.r)
  }

  return (
    <Sheet variant="full" label="Add food">
      {/* Pinned top pane: close, search, and tabs stay visible while results scroll. */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <SheetCloseButton />
          <div className="flex-1">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search foods"
              onScan={() => setScanning((s) => !s)}
            />
          </div>
        </div>

        {!scanning && (
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'favorites', label: 'Favorites' },
              { value: 'custom', label: 'Custom' },
              { value: 'all', label: 'All' },
            ]}
          />
        )}
      </div>

      {/* Plain block scroll pane (not a flex column): a flex item here would shrink the results
          card to fit and clip its overflowing rows instead of letting the pane scroll. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {scanning ? (
          <Suspense
            fallback={
              <p className="py-6 text-center text-body text-text-secondary">
                Loading scanner…
              </p>
            }
          >
            <BarcodeScanner
              onScan={(code) => {
                setScanning(false)
                openSheet(`${routes.wellness.food('off', code)}${suffix}`)
              }}
            />
          </Suspense>
        ) : (
          <>
            <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
              {results.map((r) => (
                <button
                  key={r.key}
                  onClick={r.onOpen}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-input/40"
                >
                  <span className="min-w-0 flex-1">
                    {/* Line 1: name (wraps) · heart */}
                    <span className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 break-words text-body text-text-primary">
                        {r.name}
                      </span>
                      {r.favorite ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            r.favorite!.toggle()
                          }}
                          aria-label={r.favorite.isFavorite ? 'Unfavorite' : 'Favorite'}
                          className="shrink-0"
                        >
                          {r.favorite.isFavorite ? (
                            <IconHeartFilled size={18} className="text-favorite" />
                          ) : (
                            <IconHeart size={18} className="text-text-tertiary" />
                          )}
                        </button>
                      ) : (
                        <IconHeart size={18} className="shrink-0 text-text-tertiary" />
                      )}
                    </span>
                    {/* Line 2: nutrient count · serving (left) — source (right) */}
                    <span className="mt-0.5 flex items-baseline justify-between gap-2 text-caption text-text-secondary">
                      <span className="min-w-0 truncate">
                        {r.nutrientCount} nutrients · {r.serving}
                      </span>
                      <span className="shrink-0 text-text-tertiary">{r.source}</span>
                    </span>
                  </span>
                </button>
              ))}

              {results.length === 0 && (
                <p className="px-4 py-6 text-center text-body text-text-tertiary">
                  {tab === 'all' && !debounced.trim()
                    ? 'Search USDA, or pick from Favorites/Custom.'
                    : usdaLoading
                      ? 'Searching…'
                      : 'No matches.'}
                </p>
              )}
            </div>

            {usdaError && (
              <p className="mt-3 text-caption text-danger">
                Food search unavailable — is VITE_USDA_API_KEY set?
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
