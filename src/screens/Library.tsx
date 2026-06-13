import { useCallback, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { useAsync } from '../hooks/useAsync'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { useDiaryVersion, bumpDiary } from '../lib/diary-refresh'
import { listFoods, softDeleteFood } from '../data/food'
import { listActivities, softDeleteActivity } from '../data/activity'
import { resolveActivityIcon } from '../constants/activity-icons'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { SearchBar } from '../components/SearchBar'
import { ListRow } from '../components/ListRow'
import { SwipeRow } from '../components/SwipeRow'

type Tab = 'foods' | 'activities'

export function Library() {
  const openSheet = useSheetNavigate()
  const version = useDiaryVersion()
  const [tab, setTab] = useState<Tab>('foods')
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
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'foods', label: 'Foods' },
          { value: 'activities', label: 'Activities' },
        ]}
      />
      <SearchBar value={query} onChange={setQuery} placeholder={`Search ${tab}`} />

      <button
        onClick={() => openSheet(tab === 'foods' ? '/new-food' : '/new-activity')}
        className="flex items-center gap-1 self-start text-sm text-positive"
      >
        <IconPlus size={16} /> New {tab === 'foods' ? 'Food' : 'Activity'}
      </button>

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
                  onClick={() => openSheet(`/edit-food/${f.id}`)}
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
                    onClick={() => openSheet(`/edit-activity/${a.id}`)}
                  />
                </SwipeRow>
              )
            })
          ))}
      </div>
    </div>
  )
}
