// Single source of truth for the WellWorth brand-mark geometry — a chop-seal "W" figure drawn in a
// 100x100 viewBox. Consumed by BOTH the on-screen SVG (src/components/BrandMark.tsx, rendered with
// `currentColor`) and the rasterized app icons (scripts/gen-icons.mjs, rendered with literal
// colours). Edit the geometry here once, then re-run `npm run gen:icons` to refresh the PNG/ICO
// icons so they match the on-screen mark.
//
// Plain JS (not TS) on purpose: gen-icons.mjs runs under raw Node with no TS loader, so it can't
// import a `.ts` file. The sibling `brand-mark.d.ts` gives the TypeScript build its types.

export const BRAND_MARK_VIEWBOX = '0 0 100 100'

// Outer chop-seal border — a stroked, rounded square (no fill).
export const BRAND_MARK_BORDER = {
  x: 15,
  y: 15,
  width: 70,
  height: 70,
  rx: 10,
  strokeWidth: 8,
}

// Calligraphic "W" figure — a single filled path.
export const BRAND_MARK_FIGURE =
  'M 27,51 L 34,48 L 40,63 L 46,51 L 51,53 L 57,65 C 63,56 70,52 67,44 C 64,37 52,35 40,39 C 41,36 55,31 66,35 C 75,38 75,50 66,61 C 60,68 56,70 53,70 L 47,59 L 37,70 Z'

// Floating head dot — a filled circle above the figure.
export const BRAND_MARK_DOT = { cx: 71, cy: 28, r: 5 }
