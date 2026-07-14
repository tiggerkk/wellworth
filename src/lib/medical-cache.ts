import type { ResultWithReportMeta } from '../data/medical'
import type { MedicalReportRow } from './medical'

/**
 * Last-known Medical Dashboard payload, kept **in memory only** (a plain module-level `Map`, no
 * `localStorage`/`sessionStorage`) so `useMedicalTrends` can seed `useAsync` and paint instantly on
 * re-entry instead of flashing "Loading…" every time the person tabs away from Medical and back —
 * the same stale-while-revalidate idea as `profile-cache.ts`, but deliberately NOT persisted to disk.
 *
 * Medical is the one module with its own biometric/PIN lock (`MedicalLockProvider`) specifically to
 * keep lab results off-screen from a casual look at a shared device. `profile-cache.ts` can write to
 * localStorage because it strips the lock's own secrets first — but the payload here (test names,
 * values, flags, report narratives) IS the sensitive content the lock exists to hide, and localStorage
 * persists across app restarts where the lock re-engages (`initialLocked()` in
 * `MedicalLockProvider.tsx`). Writing it to disk would let someone bypass the lock screen entirely by
 * reading storage directly. An in-memory Map disappears on reload/tab-close — same lifetime as the
 * lock's own "unlocked this session" flag — so it speeds up in-session navigation without opening that
 * gap. Keyed per user so two family members on one device never seed each other's cache.
 */
export interface MedicalDashboardCacheEntry {
  latest: ResultWithReportMeta[]
  series: ResultWithReportMeta[]
  reports: MedicalReportRow[]
}

const cache = new Map<string, MedicalDashboardCacheEntry>()

export function getCachedMedicalDashboard(
  userId: string,
): MedicalDashboardCacheEntry | undefined {
  return cache.get(userId)
}

export function setCachedMedicalDashboard(
  userId: string,
  entry: MedicalDashboardCacheEntry,
): void {
  cache.set(userId, entry)
}

export function clearCachedMedicalDashboard(userId: string): void {
  cache.delete(userId)
}
