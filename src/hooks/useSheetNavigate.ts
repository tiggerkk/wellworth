import { useCallback } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router'

/**
 * Open a route-based sheet while keeping the current tab as the painted background.
 * Preserves the original background across stacked sheets (e.g. Diary Food Picker → Diary Food Detail
 * both keep the Diary behind them), so the Back button unwinds one level at a time.
 *
 * `extraState` merges additional caller data into the sheet's `location.state` alongside
 * `background` — e.g. a Dashboard passing its already-loaded rows to a stats drill-in sheet so the
 * sheet doesn't need its own fetch (see Travel's `statsProvinces`/`statsCities`).
 */
export function useSheetNavigate(): (
  to: string,
  options?: { state?: Record<string, unknown> },
) => void {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    (to: string, options?: { state?: Record<string, unknown> }) => {
      const background =
        (location.state as { background?: Location } | null)?.background ?? location
      navigate(to, { state: { ...options?.state, background } })
    },
    [navigate, location],
  )
}
