import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { IconPlus, IconUpload } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { useDiaryVersion, bumpDiary } from '../lib/diary-refresh'
import { listFoods, softDeleteFood } from '../data/food'
import { listActivities, softDeleteActivity } from '../data/activity'
import { resolveActivityIcon } from '../constants/activity-icons'
import { routes } from '../constants/routes'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SearchBar } from '../components/SearchBar'
import { ListRow } from '../components/ListRow'
import { SwipeRow } from '../components/SwipeRow'

type Tab = 'foods' | 'activities'

export function Library() {
  const openSheet = useSheetNavigate()
  const version = useDiaryVersion()
  // Tab lives in the URL so returning from a sheet (New/Edit Food or Activity) restores it
  // instead of resetting to Foods. A clean `/wellness/library` (no param) means Foods.
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'activities' ? 'activities' : 'foods'
  const setTab = useCallback(
    (t: Tab) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (t === 'foods') next.delete('tab')
          else next.set('tab', t)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const [query, setQuery] = useState('')

  const foodsFn = useCallback(() => {
    void version // refetch when user data changes
    return listFoods()
  }, [version])
  const { data: foods } = useAsync(foodsFn)

  const activitiesFn = useCallback(() => {
    void version
    return listActivities()
  }, [version])
  const { data: activities } = useAsync(activitiesFn)

  const q = query.trim().toLowerCase()
  const customFoods = (foods ?? []).filter(
    (f) => f.source === 'custom' && (!q || f.name.toLowerCase().includes(q)),
  )
  const filteredActivities = (activities ?? []).filter(
    (a) => !q || a.name.toLowerCase().includes(q),
  )

  async function removeFood(id: string) {
    await softDeleteFood(id)
    bumpDiary()
  }
  async function removeActivity(id: string) {
    await softDeleteActivity(id)
    bumpDiary()
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {/* Pinned top pane: tabs, search, and the New action stay visible while the list scrolls. */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'foods', label: 'Foods' },
            { value: 'activities', label: 'Activities' },
          ]}
        />
        <SearchBar value={query} onChange={setQuery} placeholder={`Search ${tab}`} />

        <div className="flex items-center gap-4">
          <button
            onClick={() =>
              openSheet(
                tab === 'foods' ? routes.wellness.newFood : routes.wellness.newActivity,
              )
            }
            className="flex items-center gap-1 text-sm text-positive"
          >
            <IconPlus size={16} /> New {tab === 'foods' ? 'Food' : 'Activity'}
          </button>
          {tab === 'foods' && (
            <button
              onClick={() => openSheet(routes.wellness.importFoods)}
              className="flex items-center gap-1 text-sm text-accent"
            >
              <IconUpload size={16} /> Import CSV…
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {tab === 'foods' &&
          (customFoods.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-tertiary">
              No custom foods yet.
            </p>
          ) : (
            customFoods.map((f) => (
              <SwipeRow key={f.id} onDelete={() => void removeFood(f.id)}>
                <ListRow
                  title={f.name}
                  subtitle={f.type === 'supplement' ? 'Supplement' : undefined}
                  onClick={() => openSheet(routes.wellness.editFood(f.id))}
                />
              </SwipeRow>
            ))
          ))}

        {tab === 'activities' &&
          (filteredActivities.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-tertiary">
              No activities yet.
            </p>
          ) : (
            filteredActivities.map((a) => {
              const Icon = resolveActivityIcon(a.icon)
              return (
                <SwipeRow key={a.id} onDelete={() => void removeActivity(a.id)}>
                  <ListRow
                    leading={<Icon size={22} stroke={1.75} />}
                    title={a.name}
                    subtitle={a.template === 'strength' ? 'Strength' : 'Duration'}
                    onClick={() => openSheet(routes.wellness.editActivity(a.id))}
                  />
                </SwipeRow>
              )
            })
          ))}
      </div>
    </div>
  )
}
