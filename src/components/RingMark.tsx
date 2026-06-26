/**
 * The WellWorth brand mark — a thick ring drawn with `currentColor`, so it tracks the accent
 * token wherever it's placed (e.g. `text-accent`). Kept visually in sync with the rasterized
 * app icons produced by `scripts/gen-icons.mjs` (same ring geometry). Used on the Login screen;
 * the installed-app / onboarding header uses the generated PNG instead.
 */
export function RingMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={className}>
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="16" />
    </svg>
  )
}
