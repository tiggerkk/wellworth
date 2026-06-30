import {
  BRAND_MARK_VIEWBOX,
  BRAND_MARK_BORDER,
  BRAND_MARK_FIGURE,
  BRAND_MARK_DOT,
} from '../lib/brand-mark'

/**
 * The WellWorth brand mark — a chop-seal "W" figure drawn with `currentColor`, so it tracks the
 * accent token wherever it's placed (e.g. `text-accent`). The geometry is the shared single source
 * in `src/lib/brand-mark.js`, which the rasterized app icons (`scripts/gen-icons.mjs`) also use, so
 * the on-screen mark and the home-screen icons can't drift. Used on the Login screen; the
 * installed-app / onboarding header uses the generated PNG instead.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={BRAND_MARK_VIEWBOX}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Traditional chop-seal border (outline) */}
      <rect
        x={BRAND_MARK_BORDER.x}
        y={BRAND_MARK_BORDER.y}
        width={BRAND_MARK_BORDER.width}
        height={BRAND_MARK_BORDER.height}
        rx={BRAND_MARK_BORDER.rx}
        stroke="currentColor"
        strokeWidth={BRAND_MARK_BORDER.strokeWidth}
      />
      {/* Calligraphic "W" figure (filled) */}
      <path d={BRAND_MARK_FIGURE} fill="currentColor" />
      {/* Floating head dot (filled) */}
      <circle
        cx={BRAND_MARK_DOT.cx}
        cy={BRAND_MARK_DOT.cy}
        r={BRAND_MARK_DOT.r}
        fill="currentColor"
      />
    </svg>
  )
}
