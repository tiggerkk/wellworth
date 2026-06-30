import { useEffect, useRef } from 'react'
import { useProfile } from './useProfile'
import { applyFontSize, isFontSize } from '../lib/font-scale'

/**
 * Reconcile the applied Dynamic Type preset with the signed-in profile, once, when the profile first
 * resolves. The boot script in index.html already applied this device's cached value for an instant
 * first paint; the profile is the cross-device source of truth, so on a fresh device it wins here.
 * We reconcile only once — after that the Settings control is the sole writer (it applies optimistically
 * and saves), so this never fights a just-made change as the profile refetches.
 */
export function useFontSizeSync(): void {
  const { data: profile } = useProfile()
  const reconciled = useRef(false)

  useEffect(() => {
    if (reconciled.current || !profile) return
    reconciled.current = true
    if (isFontSize(profile.font_size)) applyFontSize(profile.font_size)
  }, [profile])
}
