import { useCallback } from 'react'
import { useParams } from 'react-router'
import { ScreenHeaderTitle } from '../components/ScreenHeaderTitle'
import { Sheet } from '../components/Sheet'
import { NutrientReport } from '../components/NutrientReport'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { listEntriesByDay } from '../data/diary-entry'
import { formatFullDate, todayLocal } from '../lib/date'

export function WellnessDailyReportSheet() {
  const { session } = useAuth()
  const userId = session?.user.id
  const { day = todayLocal() } = useParams()

  const fn = useCallback(() => {
    if (!userId) return Promise.resolve([])
    return listEntriesByDay(userId, day)
  }, [userId, day])
  const { data: entries, loading, error } = useAsync(fn)

  return (
    <Sheet variant="full" label="Daily report">
      <ScreenHeaderTitle title={`Daily Report · ${formatFullDate(day)}`} />
      <div className="flex-1 overflow-y-auto py-2">
        <NutrientReport entries={entries} loading={loading} error={error} />
      </div>
    </Sheet>
  )
}
