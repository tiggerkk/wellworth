import { useCallback } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router'

/**
 * Open a route-based sheet while keeping the current tab as the painted background.
 * Preserves the original background across stacked sheets (e.g. Add Food → Food Detail
 * both keep the Diary behind them), so the Back button unwinds one level at a time.
 */
export function useSheetNavigate(): (to: string) => void {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    (to: string) => {
      const background =
        (location.state as { background?: Location } | null)?.background ?? location
      navigate(to, { state: { background } })
    },
    [navigate, location],
  )
}
