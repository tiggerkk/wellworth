import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router'
import { useProfile } from '../hooks/useProfile'
import { moduleForPath } from '../constants/modules'
import {
  enabledHint,
  forgetUnlocked,
  getLastActive,
  isIdleExpired,
  isUnlockedThisSession,
  rememberUnlocked,
  setEnabledHint,
  setLastActive,
} from '../lib/medical-lock'

interface MedicalLockValue {
  /** The module is currently gated (show the lock screen). */
  locked: boolean
  /** The active route is inside the Medical module. */
  inMedical: boolean
  /** Clear the gate for this session (called by the lock screen after PIN/biometric success). */
  unlock: () => void
}

const MedicalLockContext = createContext<MedicalLockValue>({
  locked: false,
  inMedical: false,
  unlock: () => {},
})

// eslint-disable-next-line react-refresh/only-export-components
export function useMedicalLock(): MedicalLockValue {
  return use(MedicalLockContext)
}

/** Initial lock guess from the persistent hint (synchronous → no Medical-content flash on cold start). */
function initialLocked(): boolean {
  return enabledHint() && !isUnlockedThisSession()
}

const ACTIVITY_THROTTLE_MS = 2_000
const IDLE_POLL_MS = 20_000

/**
 * Drives the Medical module's biometric/PIN lock (M6) — a **client-side UX gate over RLS-protected
 * data**. Re-locks on **cold start** (sessionStorage cleared) and, per the chosen
 * `medical_lock_timeout_minutes`, on **idle** (finite minutes), on **background/leave** (Immediately =
 * 0), or never (Indefinite = null). "Idle" counts time since the last Medical interaction. A persistent
 * `enabledHint` lets the gate engage synchronously before the profile loads, so locked Medical content
 * never flashes. The lock is convenience over RLS, not a cryptographic boundary (see tech-spec).
 */
export function MedicalLockProvider({ children }: { children: ReactNode }) {
  // seed:false — the profile cache strips the PIN hash, so a seeded row would read as "lock not
  // configured" for one frame and momentarily unlock Medical content. The synchronous `enabledHint`
  // below already prevents the cold-start flash, so this provider needs no seed.
  const { data: profile } = useProfile({ seed: false })
  const location = useLocation()
  const inMedical = moduleForPath(location.pathname)?.key === 'medical'

  const enabled = !!profile?.medical_lock_enabled && !!profile?.medical_lock_pin_hash
  // null = Indefinite (when enabled); 0 = Immediately. Undefined (loading) → treat as Indefinite (safe).
  const timeoutMinutes = profile?.medical_lock_timeout_minutes ?? null

  const [locked, setLocked] = useState(initialLocked)

  // Latest values for the once-attached global listeners (read through this ref). Synced in an effect
  // (never during render) so the listeners always see the current state.
  const ref = useRef({ enabled, timeoutMinutes, inMedical, locked })
  useEffect(() => {
    ref.current = { enabled, timeoutMinutes, inMedical, locked }
  })

  const unlock = useCallback(() => {
    rememberUnlocked()
    setLastActive(Date.now())
    setLocked(false)
  }, [])

  const lock = useCallback(() => {
    forgetUnlocked()
    setLocked(true)
  }, [])

  // Lock if idle past the timeout (finite minutes only; Indefinite + Immediately are handled elsewhere).
  const evaluateIdle = useCallback(() => {
    const s = ref.current
    if (!s.enabled || s.locked) return
    if (s.timeoutMinutes == null || s.timeoutMinutes <= 0) return
    if (isIdleExpired(getLastActive(), Date.now(), s.timeoutMinutes)) lock()
  }, [lock])

  // Reconcile the persistent hint + lock state when the profile (enabled) resolves/changes. This is a
  // deliberate external→React sync (profile → gate), so the set-state-in-effect is intentional.
  useEffect(() => {
    setEnabledHint(enabled)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!enabled) setLocked(false)
    else if (!isUnlockedThisSession()) setLocked(true)
  }, [enabled])

  // Throttled "Medical interaction" tracking → drives the idle clock.
  useEffect(() => {
    let last = 0
    function onActivity() {
      const s = ref.current
      if (!s.enabled || !s.inMedical || s.locked) return
      const now = Date.now()
      if (now - last > ACTIVITY_THROTTLE_MS) {
        last = now
        setLastActive(now)
      }
    }
    document.addEventListener('pointerdown', onActivity, { passive: true })
    document.addEventListener('keydown', onActivity)
    return () => {
      document.removeEventListener('pointerdown', onActivity)
      document.removeEventListener('keydown', onActivity)
    }
  }, [])

  // Visibility / focus / poll: evaluate idle on return; Immediately(0) re-locks on backgrounding.
  useEffect(() => {
    function onVisibility() {
      const s = ref.current
      if (document.visibilityState === 'visible') {
        evaluateIdle()
      } else if (s.enabled && s.inMedical && s.timeoutMinutes === 0) {
        lock()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', evaluateIdle)
    const poll = window.setInterval(evaluateIdle, IDLE_POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', evaluateIdle)
      window.clearInterval(poll)
    }
  }, [evaluateIdle, lock])

  // Route transitions: entering Medical evaluates idle then marks active; Immediately(0) re-locks on leave.
  const prevInMedical = useRef(inMedical)
  useEffect(() => {
    const wasInMedical = prevInMedical.current
    prevInMedical.current = inMedical
    if (!enabled) return
    if (inMedical && !wasInMedical) {
      evaluateIdle()
      if (!ref.current.locked) setLastActive(Date.now())
    } else if (!inMedical && wasInMedical && timeoutMinutes === 0) {
      lock()
    }
  }, [inMedical, enabled, timeoutMinutes, evaluateIdle, lock])

  const value = useMemo<MedicalLockValue>(
    () => ({ locked, inMedical, unlock }),
    [locked, inMedical, unlock],
  )

  return <MedicalLockContext value={value}>{children}</MedicalLockContext>
}
