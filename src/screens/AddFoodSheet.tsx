import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { IconHeart, IconHeartFilled, IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { SearchBar } from '../components/SearchBar'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { ListRow } from '../components/ListRow'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { useAsync } from '../hooks/useAsync'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { listFoods, setFavorite } from '../data/food'
import { searchFoods, type ExternalFood } from '../lib/food-api'
import { todayLocal } from '../lib/date'

type Tab = 'all' | 'favorites' | 'custom'
const SOURCE_TAG: Record<string, string> = { usda: 'USDA', custom: 'Custom', off: 'Off' }

export function AddFoodSheet() {
  const navigate = useNavigate()
  const openSheet = useSheetNavigate()
  const [params] = useSearchParams()
  const group = params.get('group') ?? 'snacks'
  const day = params.get('day') ?? todayLocal()
  const suffix = `?group=${group}&day=${day}`

  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350)
    return () => clearTimeout(t)
  }, [query])

  const foodsFn = useCallback(() => listFoods(), [])
  const { data: userFoods, refetch } = useAsync(foodsFn)

  const usdaFn = useCallback(
    () =>
      tab === 'all' && debounced.trim() ? searchFoods(debounced) : Promise.resolve([]),
    [tab, debounced],
  )
  const { data: usdaResults, loading: usdaLoading, error: usdaError } = useAsync(usdaFn)

  const q = query.trim().toLowerCase()
  const matchingUserFoods = (userFoods ?? []).filter((f) => {
    if (tab === 'favorites') return f.is_favorite
    if (tab === 'custom') return f.source === 'custom'
    return q ? f.name.toLowerCase().includes(q) : true
  })

  async function toggleFav(id: string, next: boolean) {
    await setFavorite(id, next)
    refetch()
  }

  function openExternal(food: ExternalFood) {
    openSheet(`/food/${food.source}/${food.externalId}${suffix}`)
  }

  return (
    <Sheet variant="full" label="Add food">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Add Food</h1>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search foods"
          onScan={() => setScanning((s) => !s)}
        />

        {scanning ? (
          <BarcodeScanner
            onScan={(code) => {
              setScanning(false)
              openSheet(`/food/off/${code}${suffix}`)
            }}
          />
        ) : (
          <>
            <SegmentedTabs
              value={tab}
              onChange={setTab}
              options={[
                { value: 'all', label: 'All' },
                { value: 'favorites', label: 'Favorites' },
                { value: 'custom', label: 'Custom' },
              ]}
            />

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
                (usdaResults ?? []).map((f) => (
                  <ListRow
                    key={`usda-${f.externalId}`}
                    title={f.name}
                    subtitle={f.brand ? `USDA · ${f.brand}` : 'USDA'}
                    onClick={() => openExternal(f)}
                  />
                ))}

              {matchingUserFoods.length === 0 && (usdaResults ?? []).length === 0 && (
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
