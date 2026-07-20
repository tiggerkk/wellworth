import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { IconPlus } from '@tabler/icons-react'
import { SheetLoader } from '../components/SheetLoader'
import { ListRow } from '../components/ListRow'
import { ActivityRowHeader } from '../components/ActivityRowHeader'
import { useAsync } from '../hooks/useAsync'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { listActivities } from '../data/activity'
import { resolveActivityIcon } from '../constants/wellness'
import { routes } from '../constants/routes'
import { todayLocal } from '../lib/date'

export function WellnessDiaryActivityPickerSheet() {
  const openSheet = useSheetNavigate()
  const [params] = useSearchParams()
  const day = params.get('day') ?? todayLocal()

  const fn = useCallback(() => listActivities(), [])
  const { data: activities, loading, error } = useAsync(fn)

  return (
    <SheetLoader
      label="Diary Activity Picker"
      title="Diary Activity Picker"
      icon="close"
      actions={
        <button
          onClick={() => openSheet(routes.wellness.newActivity)}
          aria-label="New activity"
          className="text-positive"
        >
          <IconPlus size={22} />
        </button>
      }
      loading={loading}
      error={error}
      data={activities}
      errorText="Couldn’t load activities."
    >
      {(list) => (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-2">
            {list.map((a) => {
              const Icon = resolveActivityIcon(a.icon)
              return (
                <ListRow
                  key={a.id}
                  leading={<Icon size={22} stroke={1.75} />}
                  onClick={() =>
                    openSheet(`${routes.wellness.activity(a.id)}?day=${day}`)
                  }
                >
                  <ActivityRowHeader activity={a} />
                </ListRow>
              )
            })}
            {list.length === 0 && (
              <button
                onClick={() => openSheet(routes.wellness.newActivity)}
                className="block w-full rounded-card border border-border bg-surface px-4 py-6 text-center text-body text-positive"
              >
                + Create your first activity
              </button>
            )}
          </div>
        </div>
      )}
    </SheetLoader>
  )
}
