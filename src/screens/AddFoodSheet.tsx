import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams, type Location } from 'react-router'
import { IconHeart, IconHeartFilled, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { SearchBar } from '../components/SearchBar'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { ListRow } from '../components/ListRow'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { listFoods, setFavorite } from '../data/food'
import { searchFoods, type ExternalFood } from '../lib/food-api'
import { todayLocal } from '../lib/date'

// Lazy-loaded so the ZXing barcode library is a separate chunk, fetched only when scanning.
const BarcodeScanner = lazy(() =>
  import('../components/BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
)

type Tab = 'favorites' | 'custom' | 'all'
const SOURCE_TAG: Record<string, string> = { usda: 'USDA', custom: 'Custom', off: 'Off' }

// These caches outlive the sheet's React tree. Opening a food (Food Detail) unmounts this
// sheet; clicking X / ADD TO DIARY navigates back and remounts it. Serving the last results
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
  const navigate = useNavigate()
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

  // Mirror tab + search into the URL (replace, so keystrokes don't pile up history). The
  // entry left behind when opening Food Detail then carries them, so navigate(-1) restores
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

  const q = query.trim().toLowerCase()
  const matchingUserFoods = (userFoods ?? []).filter((f) => {
    if (tab === 'favorites') return f.is_favorite
    if (tab === 'custom') return f.source === 'custom'
    return q ? f.name.toLowerCase().includes(q) : true
  })

  async function toggleFav(id: string, next: boolean) {
    await setFavorite(id, next)
    setReloadNonce((n) => n + 1)
  }

  function openExternal(food: ExternalFood) {
    openSheet(`/food/${food.source}/${food.externalId}${suffix}`)
  }

  return (
    <Sheet variant="full" label="Add food">
      {/* Pinned top pane: close, search, and tabs stay visible while results scroll. */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Close" className="shrink-0">
            <IconX size={22} className="text-text-secondary" />
          </button>
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

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {scanning ? (
          <Suspense
            fallback={
              <p className="py-6 text-center text-sm text-text-secondary">
                Loading scanner…
              </p>
            }
          >
            <BarcodeScanner
              onScan={(code) => {
                setScanning(false)
                openSheet(`/food/off/${code}${suffix}`)
              }}
            />
          </Suspense>
        ) : (
          <>
            <div className="overflow-hidden rounded-card border border-border bg-surface">
              {matchingUserFoods.map((f) => (
                <ListRow
                  key={f.id}
                  title={f.name}
                  subtitle={SOURCE_TAG[f.source] ?? f.source}
                  onClick={() => openSheet(`/food/local/${f.id}${suffix}`)}
                  trailing={
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void toggleFav(f.id, !f.is_favorite)
                      }}
                      aria-label={f.is_favorite ? 'Unfavorite' : 'Favorite'}
                    >
                      {f.is_favorite ? (
                        <IconHeartFilled size={18} className="text-accent" />
                      ) : (
                        <IconHeart size={18} className="text-text-tertiary" />
                      )}
                    </button>
                  }
                />
              ))}

              {tab === 'all' &&
                usdaResults.map((f) => (
                  <ListRow
                    key={`usda-${f.externalId}`}
                    title={f.name}
                    subtitle={f.brand ? `USDA · ${f.brand}` : 'USDA'}
                    onClick={() => openExternal(f)}
                  />
                ))}

              {matchingUserFoods.length === 0 && usdaResults.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-text-tertiary">
                  {tab === 'all' && !debounced.trim()
                    ? 'Search USDA, or pick from Favorites/Custom.'
                    : usdaLoading
                      ? 'Searching…'
                      : 'No matches.'}
                </p>
              )}
            </div>

            {usdaError && (
              <p className="text-xs text-danger">
                Food search unavailable — is VITE_USDA_API_KEY set?
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
