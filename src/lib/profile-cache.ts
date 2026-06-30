import type { Tables } from '../types/database'

/**
 * Caches the signed-in user's last-known `profile` row in localStorage so screens can paint the
 * user's chosen order/visibility on the FIRST render instead of flashing the canonical default while
 * the Supabase fetch is in flight (stale-while-revalidate — `useProfile` seeds from here, then
 * reconciles with the live fetch). Mirrors the `last-module` / `networth-liquid-filter` convention.
 *
 * Keyed per user so two family members on one device never seed each other's profile.
 *
 * SECURITY: the cache is sanitized — the Medical lock credentials (`medical_lock_pin_hash`, a
 * brute-forceable PBKDF2 hash of a 4–8 digit PIN, and `medical_lock_webauthn_id`) are NEVER written
 * to localStorage. The in-memory profile clears when the tab closes; localStorage would persist it.
 * The only consumer of those fields (`MedicalLockProvider`) deliberately opts out of this seed and
 * uses its own synchronous boolean hint (`medical-lock.ts` `enabledHint`), so stripping them is safe.
 */
const KEY_PREFIX = 'wellworth:profile:'

type Profile = Tables<'profile'>

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

/** Strip never-persist secrets before the row touches localStorage. */
function sanitize(profile: Profile): Profile {
  return { ...profile, medical_lock_pin_hash: null, medical_lock_webauthn_id: null }
}

/** The cached profile for this user, or undefined if none / storage unavailable / malformed. */
export function getCachedProfile(userId: string): Profile | undefined {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return undefined
    return JSON.parse(raw) as Profile
  } catch {
    return undefined // storage disabled (private mode) or corrupt JSON — just skip the seed
  }
}

export function setCachedProfile(userId: string, profile: Profile | null): void {
  try {
    if (profile == null) localStorage.removeItem(keyFor(userId))
    else localStorage.setItem(keyFor(userId), JSON.stringify(sanitize(profile)))
  } catch {
    // ignore — caching is a convenience for avoiding the order flash, not essential
  }
}

export function clearCachedProfile(userId: string): void {
  try {
    localStorage.removeItem(keyFor(userId))
  } catch {
    // ignore
  }
}
