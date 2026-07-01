import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { IconPlus } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { useDiaryVersion, bumpDiary } from '../lib/diary-refresh'
import { listFoods, deleteFoodSmart } from '../data/food'
import { listActivities, softDeleteActivity } from '../data/activity'
import { resolveActivityIcon } from '../constants/activity-icons'
import { routes } from '../constants/routes'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SearchBar } from '../components/SearchBar'
import { ListRow } from '../components/ListRow'
import { SwipeRow } from '../components/SwipeRow'
import { ResultCount } from '../components/ResultCount'
import { SecondaryButton } from '../components/SecondaryButton'
import { foldZh } from '../lib/zh-fold'

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

  const q = foldZh(query.trim())
  // All of the user's foods — custom items plus the USDA/OFF rows cached from a favorite, log, or
  // custom serving. Surfacing the cached ones here gives them a delete path they otherwise lack.
  const foodList = (foods ?? []).filter((f) => !q || foldZh(f.name).includes(q))
  const filteredActivities = (activities ?? []).filter(
    (a) => !q || foldZh(a.name).includes(q),
  )

  // Source/type tag shown as the row subtitle.
  function foodTag(f: { source: string; type: string }): string | undefined {
    if (f.source === 'usda') return 'USDA'
    if (f.source === 'off') return 'OFF'
    return f.type === 'supplement' ? 'Supplement' : undefined
  }

  async function removeFood(id: string) {
    await deleteFoodSmart(id)
    bumpDiary()
  }
  async function removeActivity(id: string) {
    await softDeleteActivity(id)
    bumpDiary()
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {/* Pinned top pane: tabs + search stay visible while the list scrolls. */}
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
      </div>

      {/* "XX results" on the left; the New entry point sits at the right edge of the same row. */}
      <div className="flex items-center">
        {tab === 'foods' && foodList.length > 0 && (
          <ResultCount count={foodList.length} />
        )}
        {tab === 'activities' && filteredActivities.length > 0 && (
          <ResultCount count={filteredActivities.length} />
        )}
        <SecondaryButton
          size="sm"
          className="ml-auto"
          onClick={() =>
            openSheet(
              tab === 'foods' ? routes.wellness.newFood : routes.wellness.newActivity,
            )
          }
        >
          <span className="inline-flex items-center gap-1 text-positive">
            <IconPlus size={15} /> New {tab === 'foods' ? 'Food' : 'Activity'}
          </span>
        </SecondaryButton>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {tab === 'foods' &&
          (foodList.length === 0 ? (
            <p className="px-4 py-6 text-center text-body text-text-tertiary">
              No foods yet.
            </p>
          ) : (
            foodList.map((f) => (
              <SwipeRow key={f.id} onDelete={() => void removeFood(f.id)}>
                <ListRow
                  title={f.name}
                  subtitle={foodTag(f)}
                  // Custom foods open the editor; cached USDA/OFF foods open Food Detail so their
                  // servings can be viewed/managed (they aren't editable as custom nutrient rows).
                  onClick={() =>
                    openSheet(
                      f.source === 'custom'
                        ? routes.wellness.editFood(f.id)
                        : routes.wellness.food('local', f.id),
                    )
                  }
                />
              </SwipeRow>
            ))
          ))}

        {tab === 'activities' &&
          (filteredActivities.length === 0 ? (
            <p className="px-4 py-6 text-center text-body text-text-tertiary">
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
