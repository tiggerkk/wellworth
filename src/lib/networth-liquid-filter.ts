/**
 * Persists the Net Worth "Liquid Only" view toggle in localStorage, so the choice is shared across
 * the Dashboard + Monthly Entry and survives reloads (the `last-module.ts` pattern). This is an
 * ephemeral *view* filter — not a DB preference — cleared only when the user clears site data. The
 * liquid/non-liquid classification it filters by is the durable, profile-stored setting (see
 * `liquidAssetTypes` in `networth.ts`).
 */
const STORAGE_KEY = 'wellworth:networth-liquid-only'

/** Whether the "Liquid Only" view is on (false if storage is unavailable, e.g. private mode). */
export function getLiquidOnly(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setLiquidOnly(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore — remembering the filter is a convenience, not essential
  }
}
