import { useCallback } from 'react'
import { useParams } from 'react-router'
import { SheetCloseButton } from '../components/SheetCloseButton'
import { Sheet } from '../components/Sheet'
import { NutrientReport } from '../components/NutrientReport'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { listEntriesByDay } from '../data/diary-entry'
import { formatFullDate, todayLocal } from '../lib/date'

export function DailyReportSheet() {
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
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SheetCloseButton />
        <h1 className="text-heading font-medium text-text-primary">
          Daily Report · {formatFullDate(day)}
        </h1>
      </header>
      <div className="flex-1 overflow-y-auto py-2">
        <NutrientReport entries={entries} loading={loading} error={error} />
      </div>
    </Sheet>
  )
}
