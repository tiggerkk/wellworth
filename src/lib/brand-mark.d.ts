// Types for the plain-JS brand-mark geometry (brand-mark.js). Hand-written because the runtime
// module is `.js` (so scripts/gen-icons.mjs can import it under raw Node); this gives the strict
// TypeScript build its types without enabling `allowJs`.

export declare const BRAND_MARK_VIEWBOX: string

export declare const BRAND_MARK_BORDER: {
  x: number
  y: number
  width: number
  height: number
  rx: number
  strokeWidth: number
}

export declare const BRAND_MARK_FIGURE: string

export declare const BRAND_MARK_DOT: { cx: number; cy: number; r: number }
