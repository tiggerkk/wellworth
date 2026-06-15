import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * After logging from a detail sheet (Food Detail / Activity Log), return to the Diary behind it
 * rather than to the picker the user came through.
 *
 * In **create** mode the detail sheet sits on top of its picker (Add Food / Add Activity) — two
 * sheets deep over the Diary — so we pop both. In **edit** mode the detail sheet was opened straight
 * from a Diary row, so it's one deep — pop one. (A deep-linked sheet has no painted background and no
 * picker behind it; fall back to a single pop so we never over-unwind past the app.)
 */
export function useReturnAfterLog(): (opts: { editing: boolean }) => void {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    ({ editing }) => {
      const overPicker =
        !editing &&
        (location.state as { background?: unknown } | null)?.background != null
      navigate(overPicker ? -2 : -1)
    },
    [navigate, location],
  )
}
