import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { IconPlus } from '@tabler/icons-react'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { ListRow } from '../components/ListRow'
import { useAsync } from '../hooks/useAsync'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { listActivities } from '../data/activity'
import { resolveActivityIcon } from '../constants/wellness'
import { routes } from '../constants/routes'
import { todayLocal } from '../lib/date'

export function WellnessActivityAddSheet() {
  const openSheet = useSheetNavigate()
  const [params] = useSearchParams()
  const day = params.get('day') ?? todayLocal()

  const fn = useCallback(() => listActivities(), [])
  const { data: activities, loading, error } = useAsync(fn)

  return (
    <Sheet variant="full" label="Add activity">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="flex-1 text-heading font-medium text-text-primary">
          Add Activity
        </h1>
        <button
          onClick={() => openSheet(routes.wellness.newActivity)}
          aria-label="New activity"
          className="text-positive"
        >
          <IconPlus size={22} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-body text-text-secondary">Loading…</p>}
        {error && <p className="text-body text-danger">Couldn’t load activities.</p>}
        {!loading && !error && (
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            {(activities ?? []).map((a) => {
              const Icon = resolveActivityIcon(a.icon)
              return (
                <ListRow
                  key={a.id}
                  leading={<Icon size={22} stroke={1.75} />}
                  title={a.name}
                  subtitle={a.template === 'strength' ? 'Strength' : 'Duration'}
                  onClick={() =>
                    openSheet(`${routes.wellness.activity(a.id)}?day=${day}`)
                  }
                />
              )
            })}
            {(activities ?? []).length === 0 && (
              <button
                onClick={() => openSheet(routes.wellness.newActivity)}
                className="block w-full px-4 py-6 text-center text-body text-positive"
              >
                + Create your first activity
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
