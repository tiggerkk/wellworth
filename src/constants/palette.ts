/**
 * The common color palette — single source of truth for every color-picker swatch, chart fallback
 * series, and cross-module color reference in the app. Mirrors the `--palette-*` custom properties
 * in `src/index.css` (see that file for the actual hex values and the rationale for the anchor set).
 * Import these instead of hand-typing a `'var(--color-...)'` string that reaches into another
 * module's token — that's exactly the drift risk this file exists to remove.
 */
export const PALETTE_RED = 'var(--palette-red)'
export const PALETTE_GOLD = 'var(--palette-gold)'
export const PALETTE_EMERALD = 'var(--palette-emerald)'
export const PALETTE_CYAN = 'var(--palette-cyan)'
export const PALETTE_BLUE = 'var(--palette-blue)'
export const PALETTE_PURPLE = 'var(--palette-purple)'
export const PALETTE_MAGENTA = 'var(--palette-magenta)'
export const PALETTE_BROWN = 'var(--palette-brown)'
export const PALETTE_OFF_WHITE = 'var(--palette-off-white)'
export const PALETTE_GREY = 'var(--palette-grey)'
export const PALETTE_DARK_GREY = 'var(--palette-dark-grey)'
