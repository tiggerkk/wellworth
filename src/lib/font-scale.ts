/**
 * Dynamic Type presets. A single lever — the `data-font-scale` attribute on `<html>` — drives both
 * the text scale (`--font-scale` → root `font-size`, so every rem-based size grows) and the icon
 * scale (a `.tabler-icon` transform), both defined in `src/index.css`. We persist the choice in the
 * profile (cross-device) and mirror it to localStorage so the boot script in `index.html` can apply
 * it before first paint (no flash). See docs/02_tech_spec.md (F23) + docs/03_global.md.
 */
export const FONT_SIZES = ['default', 'large', 'larger'] as const
export type FontSize = (typeof FONT_SIZES)[number]

/** Must match the key read by the inline boot script in `index.html`. */
const STORAGE_KEY = 'wellworth:font-size'

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  default: 'Default',
  large: 'Large',
  larger: 'Larger',
}

export function isFontSize(v: unknown): v is FontSize {
  return typeof v === 'string' && (FONT_SIZES as readonly string[]).includes(v)
}

/**
 * Apply a preset now: set (or clear, for 'default') the `<html>` attribute the CSS keys off, and
 * cache it for the next boot. 'default' clears the attribute so the common case carries no scale
 * override and no per-icon transform/layer.
 */
export function applyFontSize(size: FontSize): void {
  const el = document.documentElement
  if (size === 'default') delete el.dataset.fontScale
  else el.dataset.fontScale = size
  try {
    localStorage.setItem(STORAGE_KEY, size)
  } catch {
    // localStorage unavailable (private mode / disabled) — the attribute still applied this session.
  }
}
