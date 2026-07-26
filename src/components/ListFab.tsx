import { IconPlus } from '@tabler/icons-react'

interface ListFabProps {
  onClick: () => void
  /** Announced to screen readers, e.g. "New Book" — the "+" glyph is the only visible label. */
  label: string
}

/**
 * Floating "+" create action for listing screens: a round teal button pinned to the bottom-right of
 * the scrollable list, so the create action stays reachable without scrolling back to the top. Sits
 * inside the same scroll container as the list itself and uses `sticky bottom` (rather than a fixed
 * offset) so it floats just above the bottom nav regardless of the nav's rendered height. Sits at the
 * same stacking tier as page content, so routed sheets/overlays (z-30+) naturally cover it. The host
 * screen renders this only once its list has at least one row, since the empty state already carries
 * its own "+ New X" action.
 */
export function ListFab({ onClick, label }: ListFabProps) {
  return (
    <div className="sticky bottom-4 z-10 flex justify-end">
      <button
        onClick={onClick}
        aria-label={label}
        className="flex size-12 items-center justify-center rounded-full bg-positive text-bg shadow-lg transition-opacity hover:opacity-90"
      >
        <IconPlus size={26} />
      </button>
    </div>
  )
}
