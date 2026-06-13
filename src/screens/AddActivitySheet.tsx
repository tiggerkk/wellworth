import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { IconX } from '@tabler/icons-react'
import { Sheet } from '../components/Sheet'
import { ListRow } from '../components/ListRow'
import { useAsync } from '../hooks/useAsync'
import { useSheetNavigate } from '../hooks/useSheetNavigate'
import { listActivities } from '../data/activity'
import { resolveActivityIcon } from '../constants/activity-icons'
import { todayLocal } from '../lib/date'

export function AddActivitySheet() {
  const navigate = useNavigate()
  const openSheet = useSheetNavigate()
  const [params] = useSearchParams()
  const day = params.get('day') ?? todayLocal()

  const fn = useCallback(() => listActivities(), [])
  const { data: activities, loading, error } = useAsync(fn)

  return (
    <Sheet variant="full" label="Add activity">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate(-1)} aria-label="Close">
          <IconX size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-[17px] font-medium text-text-primary">Add Activity</h1>
      </header>

      <div className="p-4">
        {loading && <p className="text-sm text-text-secondary">Loading…</p>}
        {error && <p className="text-sm text-danger">Couldn’t load activities.</p>}
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
                  onClick={() => openSheet(`/activity/${a.id}?day=${day}`)}
                />
              )
            })}
            {(activities ?? []).length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-tertiary">
                No activities yet. (New Activity comes with the Library.)
              </p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
