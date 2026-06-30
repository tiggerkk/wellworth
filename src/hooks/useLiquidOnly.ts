import { useCallback, useState } from 'react'
import { getLiquidOnly, setLiquidOnly } from '../lib/networth-liquid-filter'

/**
 * Net Worth "Liquid Only" view toggle, persisted in localStorage so the choice is shared across the
 * Dashboard + Monthly Entry and survives reloads. Initialized from storage on mount; separate routes
 * never mount at once, so reading on mount is enough to keep the two screens in sync.
 */
export function useLiquidOnly(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => getLiquidOnly())
  const set = useCallback((next: boolean) => {
    setOn(next)
    setLiquidOnly(next)
  }, [])
  return [on, set]
}
