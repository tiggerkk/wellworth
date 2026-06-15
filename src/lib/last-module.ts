import { MODULES } from '../constants/modules'

/**
 * Remembers the last module the user was in, so the app reopens it on launch
 * instead of forcing through the Home hub (keeps daily Wellness use fast).
 */
const STORAGE_KEY = 'wellworth:last-module'

/** The base path of the last-used module, or null if none/unknown. */
export function getLastModuleBase(): string | null {
  try {
    const key = localStorage.getItem(STORAGE_KEY)
    return MODULES.find((m) => m.key === key)?.base ?? null
  } catch {
    return null // storage disabled (e.g. private mode)
  }
}

export function setLastModule(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // ignore — remembering the module is a convenience, not essential
  }
}
