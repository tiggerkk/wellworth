import type { CSSProperties } from 'react'

/**
 * Shared recharts theming — axis/gridline colour and tooltip box style, both driven by the
 * semantic `--color-*` CSS vars (see `src/index.css`) so every chart tracks the dark theme
 * automatically. Distinct from `constants/palette.ts`, which supplies data-series colours
 * (`--palette-*`) rather than this UI chrome.
 */
export const CHART_AXIS = 'var(--color-text-secondary)'
export const CHART_GRID = 'var(--color-border)'

/** Pass directly to a recharts `<Tooltip contentStyle={CHART_TOOLTIP_STYLE} />`. */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  color: 'var(--color-text-primary)',
}
