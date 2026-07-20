import { useCallback } from 'react'
import { OverlayTop } from './OverlayTop'
import { ScreenHeaderTitle } from './ScreenHeaderTitle'
import { NutrientReport } from './NutrientReport'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { listEntriesByDay } from '../data/diary-entry'
import { formatFullDate, type IsoDate } from '../lib/date'

interface WellnessDailyReportOverlayProps {
  day: IsoDate
  onClose: () => void
}

/**
 * Daily nutrient report — a **local** fixed overlay (not the routing `Sheet`). Opened only from
 * the Diary's report icon for the currently-viewed day; it has no onward navigation of its own, so
 * unlike the Add Food / Add Activity pickers it doesn't need to participate in the routed
 * sheet-stacking (`useSheetNavigate`) pattern.
 */
export function WellnessDailyReportOverlay({
  day,
  onClose,
}: WellnessDailyReportOverlayProps) {
  const { session } = useAuth()
  const userId = session?.user.id

  const fn = useCallback(() => {
    if (!userId) return Promise.resolve([])
    return listEntriesByDay(userId, day)
  }, [userId, day])
  const { data: entries, loading, error } = useAsync(fn)

  return (
    <OverlayTop onClose={onClose} label="Daily report">
      <ScreenHeaderTitle
        title={`Daily Report · ${formatFullDate(day)}`}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto py-2">
        <NutrientReport entries={entries} loading={loading} error={error} />
      </div>
    </OverlayTop>
  )
}
